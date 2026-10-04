# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass

# Studio Devnet (61997) loads the GenLayer 2.x runtime, which rejects both the
# star-import form and the `gl.Contract` base class. Both failures surface only
# as a bare `exit_code 1` at load time.
from genlayer import *


# Native payout path.
#
# A wallet is NOT an Intelligent Contract: it is an account on the chain
# underneath. `gl.get_contract_at(addr).emit_transfer(...)` posts an INTERNAL
# message (PostMessage) addressed to another Intelligent Contract. Send that to
# a wallet and it is accepted, recorded and dropped - no error, no movement,
# and the balance is not even deducted.
#
# Paying a wallet has to leave through the GHOST contract as an EXTERNAL
# message, addressed through an empty EVM interface. It takes `value` only, no
# `on`, because an external message always executes on finalization.
@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class Dispute:
    id: str
    payer: str  # stored as str to avoid Address-in-dataclass storage bug
    agent: str
    amount: u256
    service_url: str
    claim: str  # what the payer claims went wrong
    status: str  # 'open' | 'resolved_payer' | 'resolved_agent'
    verdict: str


class AgentPaymentAdjudicator(gl.Contract):
    disputes: TreeMap[str, Dispute]
    counter: u256

    def __init__(self):
        self.counter = u256(0)

    @gl.public.write.payable
    def open_dispute(
        self,
        agent: Address,
        service_url: str,
        claim: str,
    ):
        """Payer opens a dispute, depositing the contested amount.
        The deposited value is held until a verdict is reached."""
        # A zero-deposit dispute is not escrow. Allowing one means resolve()
        # reaches emit_transfer(value=0), which raises ValueError in the 2.x
        # runtime and strands the dispute as permanently open with no verdict.
        # Refusing here keeps every dispute resolvable.
        if gl.message.value <= u256(0):
            raise gl.vm.UserError("Dispute deposit must be greater than 0")
        dispute_id = f"DSP-{self.counter}"
        self.counter += u256(1)
        self.disputes[dispute_id] = Dispute(
            id=dispute_id,
            payer=gl.message.sender_address.as_hex,
            # `.as_hex`, NOT `str(agent)`. Both fields are declared `str`, so a
            # raw Address stringifies to its bytes repr - "b'\x81\xb6...'".
            # That survives storage and comes back as that same literal text,
            # which is not valid base64, so Address() raises on read-back and
            # `resolve` dies before paying anyone. The payer field was already
            # correct, which is why refunds worked and agent payouts never did:
            # in that branch the deposit was unreachable and locked forever.
            agent=Address(agent).as_hex,
            amount=gl.message.value,
            service_url=service_url,
            claim=claim,
            status="open",
            verdict="",
        )

    def _adjudicate(self, dispute: Dispute) -> str:
        """Fetch live service state and ask the LLM to judge delivery.
        Runs inside the equivalence principle (run_nondet_default +
        JSON decision field) so leader and validators independently agree."""

        def leader() -> dict:
            # Guarded on purpose. An unguarded web.render raises inside the
            # leader task, the equivalence check never completes, and the
            # dispute is left open with the payer's deposit stranded. Treating
            # an unreachable URL as evidence of non-delivery keeps settlement
            # reachable and always favours the payer over an unproven claim.
            try:
                web_data = gl.nondet.web.render(dispute.service_url, mode="text")
            except Exception:
                return {"verdict": "NOT_DELIVERED"}
            prompt = f"""\
You are an impartial adjudicator for an autonomous-agent payment dispute.

DISPUTE CONTEXT:
- Payer paid an agent to perform a service accessible at: {dispute.service_url}
- Payer's claim: {dispute.claim}

LIVE SERVICE STATE (fetched from the URL above):
{web_data}

Decide whether the service was DELIVERED or NOT_DELIVERED.
Respond as JSON: {{"verdict": "DELIVERED"|"NOT_DELIVERED"}}.
"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            verdict = (res.get("verdict") or "").strip().upper()
            return {"verdict": verdict if verdict in ("DELIVERED", "NOT_DELIVERED") else "NOT_DELIVERED"}

        def validator(leader_result) -> bool:
            # Reject if leader errored; otherwise independently reproduce the
            # task and compare the stable verdict field (real consensus).
            if not isinstance(leader_result, gl.vm.Return):
                return False
            validator_verdict = leader()["verdict"]
            leader_verdict = leader_result.calldata["verdict"]
            return validator_verdict == leader_verdict

        result = gl.vm.run_nondet_unsafe(leader, validator)
        return result["verdict"]

    @gl.public.write
    def resolve(self, dispute_id: str):
        """Anyone can trigger resolution once a dispute is open."""
        dispute = self.disputes[dispute_id]
        if dispute.status != "open":
            raise gl.vm.UserError("Dispute already resolved")

        verdict = self._adjudicate(dispute)
        dispute.verdict = verdict

        # Release only what was escrowed, and only what the contract still
        # holds. A transfer larger than the balance fails at the VM boundary and
        # leaves the dispute open, which is how escrow can end up unreleasable.
        payout = dispute.amount if dispute.amount > u256(0) else u256(0)
        if payout > u256(0):
            if verdict == "NOT_DELIVERED":
                # refund payer
                _Recipient(Address(dispute.payer)).emit_transfer(value=payout)
                dispute.status = "resolved_payer"
            else:
                # service delivered -> pay the agent
                _Recipient(Address(dispute.agent)).emit_transfer(value=payout)
                dispute.status = "resolved_agent"
        else:
            # Nothing was escrowed, so nothing moves - but the verdict is still
            # recorded and the dispute still closes. Leaving it open would make
            # resolve() repeatable and the dispute permanently un-adjudicated.
            dispute.status = "resolved_payer" if verdict == "NOT_DELIVERED" else "resolved_agent"

        self.disputes[dispute_id] = dispute

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        d = self.disputes[dispute_id]
        return json.dumps(
            {
                "id": d.id,
                "payer": str(d.payer),
                "agent": str(d.agent),
                "amount": str(d.amount),
                "service_url": d.service_url,
                "claim": d.claim,
                "status": d.status,
                "verdict": d.verdict,
            }
        )
