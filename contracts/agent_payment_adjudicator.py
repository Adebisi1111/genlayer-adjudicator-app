# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


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
        dispute_id = f"DSP-{self.counter}"
        self.counter += u256(1)
        self.disputes[dispute_id] = Dispute(
            id=dispute_id,
            payer=gl.message.sender_address.as_hex,
            agent=Address(agent).as_hex,
            amount=gl.message.value,
            service_url=service_url,
            claim=claim,
            status="open",
            verdict="",
        )

    def _adjudicate(self, dispute: Dispute) -> str:
        """Fetch live service state and ask the LLM to judge delivery.
        Runs inside the equivalence principle (canonical run_nondet_unsafe +
        JSON decision field) so leader and validators independently agree."""

        def leader() -> dict:
            web_data = gl.nondet.web.render(dispute.service_url, mode="text")
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

        if verdict == "NOT_DELIVERED":
            # refund payer
            gl.get_contract_at(Address(dispute.payer)).emit_transfer(value=dispute.amount)
            dispute.status = "resolved_payer"
        else:
            # service delivered -> pay the agent
            gl.get_contract_at(Address(dispute.agent)).emit_transfer(value=dispute.amount)
            dispute.status = "resolved_agent"

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
