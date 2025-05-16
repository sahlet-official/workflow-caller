#!/usr/bin/env python3

import sys
import time
import os
import requests
import jwt

# https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
def gen_github_app_jwt(signing_key, app_id):
    try:
        payload = {
            # Issued at time
            'iat': int(time.time()),
            # JWT expiration time (10 minutes maximum)
            'exp': int(time.time()) + 600,
            
            # GitHub App's application ID
            'iss': app_id
        }

        # Create JWT
        encoded_jwt = jwt.encode(payload, signing_key, algorithm='RS256')

        return encoded_jwt
    except Exception as err:
        print(f"An error occurred: {err}", file=sys.stderr)
        return None

# https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-a-repository-installation-for-the-authenticated-app
def get_repo_installation_id(encoded_jwt, owner, repo):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {encoded_jwt}",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/installation"

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get("id")

    except Exception as err:
        print(f"An error occurred: {err}", file=sys.stderr)
        return None

# https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-an-organization-installation-for-the-authenticated-app
def get_org_installation_id(encoded_jwt, owner):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {encoded_jwt}",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    url = f"https://api.github.com/orgs/{owner}/installation"

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get("id")

    except Exception as err:
        print(f"An error occurred: {err}", file=sys.stderr)
        return None

# https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-a-user-installation-for-the-authenticated-app
def get_user_installation_id(encoded_jwt, owner):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {encoded_jwt}",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    url = f"https://api.github.com/users/{owner}/installation"

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get("id")

    except Exception as err:
        print(f"An error occurred: {err}", file=sys.stderr)
        return None

# https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#create-an-installation-access-token-for-an-app
def get_installation_token(encoded_jwt, installation_id):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {encoded_jwt}",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"

    try:
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        return response.json().get("token")

    except Exception as err:
        print(f"An error occurred: {err}", file=sys.stderr)
        return None

OWNER_NAME = os.environ.get("OWNER_NAME")
REPO_NAME = os.environ.get("REPO_NAME")
GIT_HUB_APP_PRIVATE_KEY = os.environ.get("GIT_HUB_APP_PRIVATE_KEY")
GIT_HUB_APP_ID = os.environ.get("GIT_HUB_APP_ID")

if not all([OWNER_NAME, GIT_HUB_APP_PRIVATE_KEY, GIT_HUB_APP_ID]):
    print("Error: Missing required environment variables.", file=sys.stderr)
    sys.exit(1)

encoded_jwt = gen_github_app_jwt(GIT_HUB_APP_PRIVATE_KEY, GIT_HUB_APP_ID)

if not encoded_jwt:
    print("encoded_jwt=null", file=sys.stderr)
    sys.exit(1)

# --------------------------------------------------------

if REPO_NAME:
    installation_id = get_repo_installation_id(encoded_jwt, OWNER_NAME, REPO_NAME)

if not installation_id:
    installation_id = get_org_installation_id(encoded_jwt, OWNER_NAME)

if not installation_id:
    installation_id = get_user_installation_id(encoded_jwt, OWNER_NAME)

if not installation_id:
    print("installation_id=null", file=sys.stderr)
    sys.exit(1)

print("✅ Got installation_id", file=sys.stderr)

# --------------------------------------------------------

installation_token = get_installation_token(encoded_jwt, installation_id)

if not installation_token:
    print("installation_token=null", file=sys.stderr)
    sys.exit(1)

print("✅ Got installation_token", file=sys.stderr)

# --------------------------------------------------------

sys.stdout.write(installation_token)