"""
API Integration Guide for DebtEase
===================================
This script helps upload merged_dataset.json to JSONBin.io for API integration.

Steps:
1. Sign up at https://jsonbin.io (free account)
2. Create a new bin and note your BIN_ID and API_KEY
3. Run this script with your credentials
4. The API URL will be available for integration

Alternatively, use MockAPI.io:
- Visit https://www.mockapi.io/
- Create a new project/endpoint
- Upload or paste the merged_dataset.json
"""

import json
import requests

def upload_to_jsonbin(bin_id, api_key):
    """Upload merged_dataset.json to JSONBin.io"""
    try:
        with open('merged_dataset.json', 'r') as f:
            data = json.load(f)
        
        headers = {
            'Content-Type': 'application/json',
            'X-Bin-Name': 'DebtEase-Dataset',
            'X-Master-Key': api_key
        }
        
        url = f'https://api.jsonbin.io/v3/b/{bin_id}'
        response = requests.put(url, json=data, headers=headers)
        
        if response.status_code == 200:
            print("✅ Successfully uploaded to JSONBin.io")
            print(f"📍 Endpoint: https://api.jsonbin.io/v3/b/{bin_id}/latest")
            print(f"🔑 API Key: {api_key}")
            
            # Create an example fetch code snippet
            fetch_code = f"""
// Example JavaScript fetch from your web app:
fetch('https://api.jsonbin.io/v3/b/{bin_id}/latest', {{
    headers: {{
        'X-Access-Key': '{api_key}'
    }}
}})
.then(res => res.json())
.then(data => console.log(data.record))
.catch(err => console.error(err));
            """
            print("\n📋 JavaScript Fetch Example:")
            print(fetch_code)
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return False
    except FileNotFoundError:
        print("❌ merged_dataset.json not found!")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def manual_upload_instructions():
    """Display manual upload instructions"""
    print("""
╔════════════════════════════════════════════════════════════════╗
║            MANUAL API SETUP - JSONBin.io / MockAPI.io          ║
╚════════════════════════════════════════════════════════════════╝

OPTION 1: JSONBin.io (Recommended)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to https://jsonbin.io
2. Click "Create Bin" or login with GitHub
3. Paste the content of merged_dataset.json
4. Copy the BIN_ID from the URL (e.g., https://jsonbin.io/b/{BIN_ID})
5. Get your API Key from settings
6. Use the following fetch URL in your HTML:

   fetch('https://api.jsonbin.io/v3/b/YOUR_BIN_ID/latest', {
       headers: {
           'X-Access-Key': 'YOUR_API_KEY'
       }
   })

OPTION 2: MockAPI.io
━━━━━━━━━━━━━━━━━━━
1. Go to https://www.mockapi.io/
2. Create a new project
3. Create a new endpoint (e.g., 'dataset')
4. Upload/paste merged_dataset.json content
5. Copy the endpoint URL
6. Use in fetch:

   fetch('https://your-project-id.mockapi.io/api/datasets')

OPTION 3: GitHub (Free Alternative)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Push merged_dataset.json to your GitHub repo
2. Open the file and click "Raw"
3. Use the raw GitHub URL in fetch

═══════════════════════════════════════════════════════════════════
    """)

if __name__ == "__main__":
    print("\n🔗 DebtEase API Integration Setup\n")
    
    # Check for credentials file
    try:
        with open('api_credentials.json', 'r') as f:
            credentials = json.load(f)
            bin_id = credentials.get('bin_id')
            api_key = credentials.get('api_key')
            
            if bin_id and api_key:
                print("Found api_credentials.json")
                upload_to_jsonbin(bin_id, api_key)
            else:
                manual_upload_instructions()
    except FileNotFoundError:
        print("api_credentials.json not found.\n")
        manual_upload_instructions()
        
        # Create a template
        template = {
            "bin_id": "YOUR_BIN_ID_HERE",
            "api_key": "YOUR_API_KEY_HERE",
            "note": "Fill in your credentials and save. Then run: python api_integration.py"
        }
        
        with open('api_credentials_template.json', 'w') as f:
            json.dump(template, f, indent=4)
        
        print("\n✅ Template created: api_credentials_template.json")
        print("   Fill in your credentials and rename to: api_credentials.json")