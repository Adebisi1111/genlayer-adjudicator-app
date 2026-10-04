"""Guards added when porting the adjudicator to the GenLayer 2.x runtime.

These cover two defects that only exist on 2.x, plus the fetch guard.
"""
import json


def _open(vm, contract, payer, agent, url="https://example.com/service",
          claim="service not delivered", value=100):
    vm.sender = payer
    vm.value = value
    contract.open_dispute(agent, url, claim)
    return "DSP-0"


def test_zero_deposit_is_refused(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A dispute with nothing escrowed must be refused at open time.

    On 2.x, emit_transfer(value=0) raises ValueError. A zero-deposit dispute
    that opens successfully therefore reaches settlement and dies there,
    stranding the record as permanently open with no verdict.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    with direct_vm.expect_revert():
        contract.open_dispute(direct_bob, "https://example.com/service", "claim")


def test_one_wei_deposit_is_allowed(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The minimum is greater than zero, not a round number of GEN.

    Guards the boundary: a check written as `>= 1 GEN` would reject legitimate
    dust disputes and break the amount-fidelity property.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob, value=1)
    d = json.loads(contract.get_dispute(dispute_id))
    assert d["amount"] == "1", d


def test_unreachable_evidence_settles_as_refund(direct_vm, direct_deploy,
                                                direct_alice, direct_bob):
    """An unfetchable URL must still reach a verdict.

    web.render is wrapped in try/except: an unguarded fetch raises inside the
    leader task, the equivalence check never completes, and the dispute is left
    open with the payer's deposit stranded. Unreachable evidence must resolve
    to NOT_DELIVERED so the payer can be refunded.
    """
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob,
                       url="https://unreachable-9f3a2b.example/svc")

    direct_vm.mock_web(r".*unreachable.*", {"status": 500, "body": "unreachable"})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "NOT_DELIVERED"}))

    contract.resolve(dispute_id)
    d = json.loads(contract.get_dispute(dispute_id))
    assert d["status"] == "resolved_payer", d
    assert d["verdict"] == "NOT_DELIVERED", d
    direct_vm.clear_mocks()


def test_refund_returns_the_exact_escrowed_amount(direct_vm, direct_deploy,
                                                  direct_alice, direct_bob):
    """The payout must equal what was escrowed, not a rounded figure."""
    contract = direct_deploy("contracts/_local_pin_adjudicator.py")
    dispute_id = _open(direct_vm, contract, direct_alice, direct_bob, value=12345)

    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": "404"})
    direct_vm.mock_llm(r".*adjudicator.*", json.dumps({"verdict": "NOT_DELIVERED"}))
    contract.resolve(dispute_id)

    d = json.loads(contract.get_dispute(dispute_id))
    assert d["amount"] == "12345", d
    assert d["status"] == "resolved_payer", d
    direct_vm.clear_mocks()
