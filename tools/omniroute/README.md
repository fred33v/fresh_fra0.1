# OmniRoute (local AI gateway)

[OmniRoute](https://github.com/diegosouzapw/OmniRoute) is an AI router: one
OpenAI-compatible API in front of many AI providers, with automatic fallback
and cost tracking. It is set up here as a **local tool**. None of the apps use
it yet, and it is not deployed.

## Requirements

OmniRoute 3.8.51 needs **Node 22.22.2 or newer**. The project stays on Node 20,
so OmniRoute runs on a separate Node 22 in `~/.local/node22` (or set
`OMNIROUTE_NODE_DIR` to another folder):

```bash
~/.local/node22/bin/npm install -g omniroute@3.8.51
```

## Use

```bash
pnpm ai-gateway        # start: dashboard at http://127.0.0.1:20128
pnpm ai-gateway:stop   # stop
pnpm ai-gateway:test   # check an OmniRoute API key (asks for it; never shown or saved)
```

On first run `tools/omniroute/.env` is created with random secrets (git ignores
it). Your first dashboard password is its `INITIAL_PASSWORD` line; change it
after signing in. OmniRoute's database, logs and any provider API keys you add
are kept in `~/.omniroute-fresh-fra`, outside the project.

The gateway listens only on this computer and requires an API key. Create one
in the dashboard under **API Keys**, then point code at
`http://127.0.0.1:20128/v1` with that key, as with any OpenAI-compatible API.
