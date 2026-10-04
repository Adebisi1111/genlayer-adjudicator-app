"""Generate a 1.x-loadable copy of the v2 adjudicator for local tests.

Studio Devnet (61997) runs the 2.x runner and needs `gl.contract.Contract` plus
`genlayer.storage`; the runner gltest has locally is 1.x and accepts the
star-import form with `gl.Contract`. Rewrite the 2.x-only constructs for the
local copy so the chain source stays canonical and the two cannot drift.
"""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "contracts" / "agent_payment_adjudicator_v2.py"
LOCAL = SRC.parent / "_local_pin_adjudicator.py"
LOCAL_PIN = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"

# Match the explicit-import BLOCK rather than an exact string, so adding a name
# to the block does not silently stop the rewrite.
_EXPLICIT_IMPORTS = re.compile(
    r"^import genlayer as gl\n"
    r"^from genlayer import .*\n"
    r"^from genlayer\.storage import TreeMap\n"
    r"^from genlayer\.storage import allow as allow_storage$",
    re.MULTILINE,
)

# The 2.x runner renamed this entrypoint; the local 1.x runner still has the
# old name. Rewrite it back so tests exercise the same logic.
_NONDET = re.compile(r"gl\.vm\.run_nondet_default\b")


def build() -> Path:
    src = re.sub(r"py-genlayer:[a-z0-9]+", LOCAL_PIN, SRC.read_text(), count=1)
    src = src.replace("gl.contract.Contract", "gl.Contract")
    src = _NONDET.sub("gl.vm.run_nondet_unsafe", src)
    src, n = _EXPLICIT_IMPORTS.subn("from genlayer import *", src)
    if n != 1:
        raise RuntimeError(
            f"expected to rewrite one explicit-import block, rewrote {n}. "
            "The chain source changed shape - update this helper."
        )
    LOCAL.write_text(src)
    return LOCAL
