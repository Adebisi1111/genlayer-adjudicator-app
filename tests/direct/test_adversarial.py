import json


def _hex(addr) -> str:
    """gltest fixtures hand back raw 20-byte addresses; the contract stores hex."""
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    return str(addr).lower()

# Adversarial coverage for the escrow path of Agent Payment Adjudicator.
#
# The four pre-existing tests only exercise happy paths. These target the
# properties that decide who gets paid: unknown disputes, unauthorized
# resolution, evidence that cannot be fetched, verdicts the model invents, and
# agent substitution. Each test is paired with the defect it catches.


def _open(direct_vm, contract, payer, agent, url="https://example.com/service",
          claim="service not delivered", value=100):
    direct_vm.sender = payer
    direct_vm.value = value
    contract.open_dispute(agent, url, claim)
    return "DSP-0"


def test_unknown_dispute_is_refused_cleanly(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Resolving a dispute that does not exist must refuse, not crash.

    `resolve` indexes self.disputes[dispute_id] directly, so an unknown id
    raises a storage lookup error rather than a message a payer can act on.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert():
        contract.resolve("DSP-does-not-exist")


def test_get_dispute_unknown_is_refused(direct_vm, direct_deploy, direct_alice):
    """Reading a dispute that does not exist must refuse cleanly."""
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert():
        contract.get_dispute("DSP-nope")


def test_unreachable_service_defaults_to_refund(direct_vm, direct_deploy, direct_alice, direct_bob):
    """If the evidence URL cannot be fetched, the payer is refunded.

    web.render raising inside leader() must not strand the deposit: the
    catch-all in _adjudicate has to yield NOT_DELIVERED so funds return to
    the payer rather than being paid out on missing evidence.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob,
                       url="https://this-host-does-not-exist-8f2a1b.example/x")

    # The fetch fails inside the leader task. Whichever way the runtime
    # surfaces it, the payout decision must favour the payer.
    direct_vm.mock_web(r".*does-not-exist.*", {"status": 500, "body": "unreachable"})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "NOT_DELIVERED"}))

    contract.resolve(dispute_id)
    result = json.loads(contract.get_dispute(dispute_id))
    assert result["status"] == "resolved_payer", result
    assert result["verdict"] == "NOT_DELIVERED", result
    direct_vm.clear_mocks()


def test_invented_verdict_cannot_pay_the_agent(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A verdict outside the allowed set must not release funds to the agent.

    The model is free to return anything. An unrecognised verdict must fall
    back to NOT_DELIVERED so a malformed response can never pay out.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob)

    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": "service page"})
    # Verdict the contract never asked for.
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "PROBABLY_FINE"}))

    contract.resolve(dispute_id)
    result = json.loads(contract.get_dispute(dispute_id))
    assert result["verdict"] == "NOT_DELIVERED", result
    assert result["status"] == "resolved_payer", result
    direct_vm.clear_mocks()


def test_disputing_yourself_is_not_a_get_out(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Naming yourself as agent must still be adjudicated, not auto-paid.

    Otherwise a payer could name themselves as the agent and collect the
    deposit twice: refunded as payer, and paid as agent.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.open_dispute(direct_alice, "https://example.com/service", "claim")

    dispute = json.loads(contract.get_dispute("DSP-0"))
    assert dispute["payer"].lower() == _hex(direct_alice)
    assert dispute["agent"].lower() == _hex(direct_alice)


def test_deposit_is_recorded_from_message_value(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The contested amount recorded must equal the value actually sent.

    Escrow is only sound if the ledger amount cannot diverge from the funds
    the contract holds.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 777
    contract.open_dispute(direct_bob, "https://example.com/service", "claim")

    dispute = json.loads(contract.get_dispute("DSP-0"))
    assert int(dispute["amount"]) == 777, dispute


def test_each_dispute_is_numbered_uniquely(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Two disputes from one payer must not collide on id.

    If the counter is not advanced, the second deposit would overwrite the
    first record and one escrow could be settled twice.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.open_dispute(direct_bob, "https://example.com/a", "first")
    direct_vm.value = 250
    contract.open_dispute(direct_bob, "https://example.com/b", "second")

    first = json.loads(contract.get_dispute("DSP-0"))
    second = json.loads(contract.get_dispute("DSP-1"))
    assert first["amount"] == "100", first
    assert second["amount"] == "250", second
    assert first["service_url"] != second["service_url"]


def test_second_resolve_after_payout_is_refused(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Once funds are released the dispute must be closed to further payouts.

    This is the double-spend guard: without it a resolved dispute could be
    resolved again and pay the agent twice.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob)

    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": "done"})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "DELIVERED"}))
    contract.resolve(dispute_id)

    with direct_vm.expect_revert("Dispute already resolved"):
        contract.resolve(dispute_id)
    direct_vm.clear_mocks()


def test_agent_address_cannot_be_swapped_after_opening(direct_vm, direct_deploy,
                                                        direct_alice, direct_bob):
    """The agent recorded at opening is the agent paid at settlement.

    The payout branch trusts dispute.agent. If that field were writable by the
    payer, a payer could name any address and redirect the agent's payout.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob,
                       url="https://example.com/service")

    recorded = json.loads(contract.get_dispute(dispute_id))
    assert recorded["agent"].lower() == _hex(direct_bob), recorded

    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": "done"})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "DELIVERED"}))
    contract.resolve(dispute_id)

    after = json.loads(contract.get_dispute(dispute_id))
    assert after["agent"].lower() == _hex(direct_bob), after
    assert after["status"] == "resolved_agent", after
    direct_vm.clear_mocks()