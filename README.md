# workflow-caller
It is a code for GitHub App that lets you make secure workflow calls between repositories.
You can manage which repo can call which workflow by setting a permissions config.
Also you can call API of this GitHub App out of GitHub Actions (TODO).

## Dev setup
1. Install Docker Desktop (Windows) or Docker and Docker Compose
2. Checkout this repo
3. Copy and rename file [.env.template](./.env.template) to .env and edit it as you need
4. For debug run ./debug.sh (in Git Bash on Windows)
5. For release run launch ./run.sh
6. For debug attachment you can use ./.vscode/launch.example.json (if you use VSCode)

## Example of use
1. In github workflow<br>
```
    - name: Call
    id: call
    uses: sahlet-official/workflow-caller@latest
    with:
        address: example.com
        owner: github-org-name
        repo: github-repo-name
        workflow: workflow-filename
        ref: main
        input: '{ "input_field": "value" }'
        call_type: TriggerAndWaitResult

    - name: Print result
    run: |
        echo "${{ steps.call.outputs.result }}"
```

2. Called workflow has to have this field, to be identifies <br>
```
run-name: Some name "${{ inputs.environment_name }}" environment [${{ inputs.run_unique_id && inputs.run_unique_id || 'NA' }}]
```

3. To get result from called workflow you have to add code to workflow that makes result artifact with result json.<br>
```
    - name: Generate result JSON using jq
    run: |
        echo '{}' | jq '.output = "lol"' > result.json

    - name: Upload result.json as artifact
    uses: actions/upload-artifact@v4
    with:
        name: result
        path: result.json
```