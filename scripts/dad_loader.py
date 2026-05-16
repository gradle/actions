"""Drop-in loader for DREDGE Agent Descriptor (DAD)."""

from __future__ import annotations

from pathlib import Path
import json


try:
    import yaml  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - fallback used in constrained envs
    yaml = None


class _SimpleYamlLoader:
    """Minimal YAML loader for this descriptor subset (maps/lists/scalars)."""

    @staticmethod
    def _parse_scalar(value: str):
        value = value.strip()
        if not value:
            return ""
        if value.startswith('"') and value.endswith('"'):
            return value[1:-1]
        if value in {"true", "false"}:
            return value == "true"
        return value

    @classmethod
    def load(cls, text: str):
        lines = text.splitlines()
        root = {}
        stack = [(-1, root)]

        i = 0
        while i < len(lines):
            raw = lines[i]
            if not raw.strip() or raw.lstrip().startswith("#"):
                i += 1
                continue

            indent = len(raw) - len(raw.lstrip(" "))
            line = raw.strip()

            while len(stack) > 1 and indent <= stack[-1][0]:
                stack.pop()
            parent = stack[-1][1]

            if line.startswith("- "):
                item = cls._parse_scalar(line[2:])
                if isinstance(parent, list):
                    parent.append(item)
                i += 1
                continue

            key, _, rest = line.partition(":")
            key = key.strip()
            rest = rest.strip()

            if rest == "|":
                block = []
                i += 1
                while i < len(lines):
                    nxt = lines[i]
                    nindent = len(nxt) - len(nxt.lstrip(" "))
                    if nxt.strip() and nindent <= indent:
                        break
                    block.append(nxt[indent + 2 :] if len(nxt) >= indent + 2 else "")
                    i += 1
                parent[key] = "\n".join(block).rstrip("\n")
                continue

            if rest:
                parent[key] = cls._parse_scalar(rest)
                i += 1
                continue

            # Determine whether next block is list or dict
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            is_list = j < len(lines) and lines[j].lstrip().startswith("- ")
            parent[key] = [] if is_list else {}
            stack.append((indent, parent[key]))
            i += 1

        return root


class DAD:
    def __init__(self, path: str):
        self.path = path
        raw = Path(path).read_text()
        if yaml is not None:
            self.spec = yaml.safe_load(raw)
        else:
            self.spec = _SimpleYamlLoader.load(raw)

    @property
    def identity(self):
        return self.spec["identity"]

    @property
    def capabilities(self):
        return self.spec["capabilities"]

    def can(self, capability: str):
        section, key = capability.split(".")
        return self.capabilities.get(section, {}).get(key, False)

    def route(self):
        return self.spec["routing"]["preferred_orchestrator"]

    def scripture(self):
        return self.spec["scripture"]

    def summary(self):
        return {
            "id": self.spec["dad"]["id"],
            "class": self.spec["dad"]["class"],
            "route": self.route(),
            "autonomous": self.can("cognition.autonomous"),
        }


def spawn(chain_name: str):
    print(f"spawn: {chain_name}")


def connect(target: str):
    print(f"connect: {target}")


def elevate(pathway: str):
    print(f"elevate: {pathway}")


def awaken(dad: DAD):
    if dad.can("cognition.autonomous"):
        spawn("autonomous-chain")

    if dad.can("execution.workflow_dispatch"):
        connect("github-actions")

    if dad.identity["fingerprint"]["network"]["trust_zone"] == "mesh":
        elevate("internal-routing")


def main():
    dad = DAD("dad.yaml")
    print(json.dumps(dad.summary(), sort_keys=True))
    awaken(dad)


if __name__ == "__main__":
    main()
