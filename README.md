# workflow-caller
It is a code for GitHub App that lets you make secure workflow calls between repositories.
You can manage which repo can call which workflow by setting a permissions config.
Also you can call API of this GitHub App out of GitHub Actions.

## Dev setup
1. Install Docker Desktop (Windows) or Docker and Docker Compose
2. Checkout this repo
3. Copy and rename file [.env.template](./.env.template) to .env and edit it as you need
4. For debug run ./debug.sh (in Git Bash on Windows)
5. For release run launch ./run.sh
6. For debug attachment you can use ./.vscode/launch.example.json (if you use VSCode)
