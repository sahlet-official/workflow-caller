#!/usr/bin/env python3

# import sys
# import os
# import requests
# import time
# import json
# import uuid
# import zipfile
# import shutil
# from datetime import datetime, timezone
# from urllib.parse import quote

# # --------------------------------------------------------

# def add_run_unique_id(input_json):
#     try:
#         data = json.loads(input_json)
#     except Exception as e:
#         print(f"Invalid JSON: {e}", file=sys.stderr)
#         return None

#     if "run_unique_id" not in data:
#         data["run_unique_id"] = str(uuid.uuid4())

#     return json.dumps(data)

# def get_run_unique_id(input_json):
#     try:
#         data = json.loads(input_json)
#     except Exception as e:
#         print(f"Invalid JSON: {e}", file=sys.stderr)
#         return None

#     if "run_unique_id" not in data:
#         print(f"There is no run_unique_id in input_json", file=sys.stderr)
#         return None

#     return data["run_unique_id"]

# def get_timestamp():
#     timestamp = datetime.now(timezone.utc).isoformat()

#     return timestamp

# # https://docs.github.com/en/rest/actions/workflows?apiVersion=2022-11-28#create-a-workflow-dispatch-event
# def trigger_workflow_dispatch(owner, repo, workflow_file, branch, workflow_input_json, token):
#     url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches"

#     headers = {
#         "Accept": "application/vnd.github+json",
#         "Authorization": f"Bearer {token}",
#         "X-GitHub-Api-Version": "2022-11-28"
#     }

#     data = {
#         "ref": branch,
#         "inputs": workflow_input_json
#     }

#     try:
#         response = requests.post(url, headers=headers, json=data)
#         response.raise_for_status()

#     except Exception as err:
#         print(f"An error occurred: {err}", file=sys.stderr)
#         return None

#     return True

# # https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-workflow
# def find_run_by_run_unique_id(owner, repo, workflow_file, branch, run_unique_id, timestamp, token):
#     operator = ">="
#     encoded_created = quote(f"{operator}{timestamp}")

#     url = (
#         f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/"
#         f"{workflow_file}/runs?branch={branch}&created={encoded_created}"
#     )

#     headers = {
#         "Accept": "application/vnd.github+json",
#         "Authorization": f"Bearer {token}",
#         "X-GitHub-Api-Version": "2022-11-28"
#     }

#     try:
#         for _ in range(15):
#             response = requests.get(url, headers=headers)
#             response.raise_for_status()

#             runs = response.json().get("workflow_runs", [])

#             for run in runs:
#                 title = run.get("display_title", "")

#                 if run_unique_id in title:
#                     return run

#             time.sleep(2)

#         return None
#     except Exception as err:
#         print(f"An error occurred: {err}", file=sys.stderr)
#         return None

# # https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#get-a-workflow-run
# def wait_for_run_complete_and_get(owner, repo, run_id, token):
#     url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}"

#     headers = {
#         "Accept": "application/vnd.github+json",
#         "Authorization": f"Bearer {token}",
#         "X-GitHub-Api-Version": "2022-11-28"
#     }

#     try:
#         for _ in range(1800):
#             response = requests.get(url, headers=headers)
#             response.raise_for_status()

#             run = response.json()

#             status = run.get("status", "")
            
#             if status == "completed":
#                 return run

#             time.sleep(4)

#         return None
#     except Exception as err:
#         print(f"An error occurred: {err}", file=sys.stderr)
#         return None

# # https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28#list-workflow-run-artifacts
# def get_run_artifacts_info(owner, repo, run_id, token):
#     url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"

#     headers = {
#         "Accept": "application/vnd.github+json",
#         "Authorization": f"Bearer {token}",
#         "X-GitHub-Api-Version": "2022-11-28"
#     }

#     try:
#         response = requests.get(url, headers=headers)
#         response.raise_for_status()

#         artifacts = response.json().get("artifacts", [])
#         return artifacts
#     except Exception as err:
#         print(f"An error occurred: {err}", file=sys.stderr)
#         return None

# # https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28#download-an-artifact
# def get_artifact_download_url(owner, repo, artifact_id, archive_format, token):
#     url = f"https://api.github.com/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}"

#     headers = {
#         "Accept": "application/vnd.github+json",
#         "Authorization": f"Bearer {token}",
#         "X-GitHub-Api-Version": "2022-11-28"
#     }

#     try:
#         response = requests.get(url, headers=headers)
#         response.raise_for_status()

#         download_url = response.json().get("url", "")
#         return download_url
#     except Exception as err:
#         print(f"An error occurred: {err}", file=sys.stderr)
#         return None
    
# def download_and_extract_artifact(artifact_download_url, artifact_file_name):
#     try:
#         base_dir = os.path.dirname(os.path.abspath(__file__))
#         tmp_dir = os.path.join(base_dir, "artifact_tmp")
#         zip_path = os.path.join(tmp_dir, "result.zip")
#         extract_dir = os.path.join(tmp_dir, "artifact")

#         os.makedirs(tmp_dir, exist_ok=True)

#         response = requests.get(artifact_download_url)
#         response.raise_for_status()

#         with open(zip_path, "wb") as f:
#             f.write(response.content)

#         with zipfile.ZipFile(zip_path, "r") as zip_ref:
#             zip_ref.extractall(extract_dir)

#         result_json_path = os.path.join(extract_dir, artifact_file_name)

#         if not os.path.isfile(result_json_path):
#             raise FileNotFoundError(f"file {artifact_file_name} is not found: {result_json_path}")

#         with open(result_json_path, "r", encoding="utf-8") as f:
#             content = f.read()

#         shutil.rmtree(tmp_dir)

#         return content
#     except Exception as err:
#         print(f"An error occurred: {err}", file=sys.stderr)
#         return None

# # --------------------------------------------------------

# WORKFLOW_INPUT_JSON = os.environ.get("WORKFLOW_INPUT_JSON")
# INSTALLATION_TOKEN = os.environ.get("INSTALLATION_TOKEN")
# OWNER_NAME = os.environ.get("OWNER_NAME")
# REPO_NAME = os.environ.get("REPO_NAME")
# WORKFLOW_FILENAME = os.environ.get("WORKFLOW_FILENAME")
# BRANCH_NAME = os.environ.get("BRANCH_NAME")

# # --------------------------------------------------------

# if not all([WORKFLOW_INPUT_JSON, INSTALLATION_TOKEN, OWNER_NAME, REPO_NAME, WORKFLOW_FILENAME, BRANCH_NAME]):
#     print("Error: Missing required environment variables.", file=sys.stderr)
#     sys.exit(1)

# WORKFLOW_INPUT_JSON = add_run_unique_id(WORKFLOW_INPUT_JSON)

# if not WORKFLOW_INPUT_JSON:
#     print("Something wrong with WORKFLOW_INPUT_JSON", file=sys.stderr)
#     sys.exit(1)

# run_unique_id = get_run_unique_id(WORKFLOW_INPUT_JSON)

# if not run_unique_id:
#     print("run_unique_id=null", file=sys.stderr)
#     sys.exit(1)

# # --------------------------------------------------------

# timestamp = get_timestamp()

# if not trigger_workflow_dispatch(OWNER_NAME, REPO_NAME, WORKFLOW_FILENAME, BRANCH_NAME, WORKFLOW_INPUT_JSON, INSTALLATION_TOKEN):
#     print("❌ Couldn't trigger workflow dispatch", file=sys.stderr)
#     sys.exit(1)

# print("✅ Workflow dispatched", file=sys.stderr)

# # --------------------------------------------------------

# run = find_run_by_run_unique_id(OWNER_NAME, REPO_NAME, WORKFLOW_FILENAME, BRANCH_NAME, run_unique_id, timestamp, INSTALLATION_TOKEN)

# if not run:
#     print("❌ Cant find run", file=sys.stderr)
#     sys.exit(1)

# print("✅ Got Run ID", file=sys.stderr)

# # --------------------------------------------------------

# run = wait_for_run_complete_and_get(OWNER_NAME, REPO_NAME,  run.get("id", ""), INSTALLATION_TOKEN)

# if not run:
#     print("❌ Cant find run", file=sys.stderr)
#     sys.exit(1)

# if run.get("conclusion", "") != "success":
#     print(f"❌ Run failed: {run.get("conclusion", "")}", file=sys.stderr)
#     sys.exit(1)

# print("✅ Run succeeded", file=sys.stderr)

# # --------------------------------------------------------

# artifacts = get_run_artifacts_info(OWNER_NAME, REPO_NAME, run.get("id", ""), INSTALLATION_TOKEN)

# if not artifacts:
#     print("❌ Cant get run artifacts info", file=sys.stderr)
#     sys.exit(1)

# print("✅ Got run artifacts info", file=sys.stderr)

# # --------------------------------------------------------

# result_artifact = None
# artifact_name = "result"

# for artifact in artifacts:
#     name = artifact.get("name", "")

#     if name == artifact_name:
#         result_artifact = artifact

# if not result_artifact:
#     print(f"￣\_(ツ)_/￣ There is no '{artifact_name}' artifact", file=sys.stderr)
#     sys.exit(0)

# artifact_download_url = get_artifact_download_url(OWNER_NAME, REPO_NAME, result_artifact.get("id", ""), "zip", INSTALLATION_TOKEN)

# if not artifact_download_url:
#     print("❌ Cant get artifact_download_url", file=sys.stderr)
#     sys.exit(1)

# # --------------------------------------------------------

# result_file_name = "result.json"
# run_result = download_and_extract_artifact(artifact_download_url, result_file_name)

# if not run_result:
#     print(f"￣\_(ツ)_/￣ There is no '{result_file_name}' in '{artifact_name}' artifact", file=sys.stderr)
#     sys.exit(0)

# print("✅ Printing workflow result", file=sys.stderr)

# sys.stdout.write(run_result)

# # --------------------------------------------------------