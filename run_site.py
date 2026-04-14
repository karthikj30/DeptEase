#!/usr/bin/env python3
"""Run DebtEase web UI with a local HTTP server and optional email verification."""
import ast
import http.server
import json
import mimetypes
import os
import re
import socketserver
import smtplib
import ssl
import uuid
import webbrowser
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import urlparse, unquote

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
URL = f"http://127.0.0.1:{PORT}/index.html"

SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASS = os.getenv('SMTP_PASS')
SMTP_FROM = os.getenv('SMTP_FROM', SMTP_USER)

# ── Vault (document store) ──────────────────────────────────────
VAULT_DIR  = os.path.join(DIRECTORY, 'vault')
VAULT_META = os.path.join(DIRECTORY, 'vault', 'metadata.json')


def ensure_vault():
    os.makedirs(VAULT_DIR, exist_ok=True)


def load_vault_meta():
    ensure_vault()
    if not os.path.exists(VAULT_META):
        return []
    try:
        with open(VAULT_META, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def save_vault_meta(meta):
    ensure_vault()
    with open(VAULT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def parse_multipart(headers, body_bytes):
    """Extract files and form fields from multipart/form-data.
    Returns (files_dict, fields_dict)."""
    content_type = headers.get('Content-Type', '')
    m = re.search(r'boundary=([^\s;]+)', content_type)
    if not m:
        return {}, {}
    boundary = m.group(1).strip('\'"').encode('ascii')
    
    sep = b'--' + boundary
    parts = body_bytes.split(sep)
    
    files = []
    fields = {}

    for part in parts:
        if not part or part.strip() == b'' or part.startswith(b'--'):
            continue
        
        if b'\r\n\r\n' in part:
            header_part, data_part = part.split(b'\r\n\r\n', 1)
        elif b'\n\n' in part:
            header_part, data_part = part.split(b'\n\n', 1)
        else:
            continue
            
        header_text = header_part.decode('utf-8', errors='replace')
        
        # Check if this part contains a file
        fn_m = re.search(r'filename\s*=\s*["\']?([^"\'\r\n;]+)["\']?', header_text, re.IGNORECASE)
        name_m = re.search(r'name\s*=\s*["\']?([^"\'\r\n;]+)["\']?', header_text, re.IGNORECASE)
        
        # Trim trailing newline from data
        if data_part.endswith(b'\r\n'):
            data_part = data_part[:-2]
        elif data_part.endswith(b'\n'):
            data_part = data_part[:-1]

        if fn_m:
            original_name = fn_m.group(1).strip().strip('\'"')
            ct_m = re.search(r'Content-Type:\s*([^\r\n]+)', header_text, re.IGNORECASE)
            mime = ct_m.group(1).strip() if ct_m else (mimetypes.guess_type(original_name)[0] or 'application/octet-stream')
            files.append({
                'name': name_m.group(1) if name_m else 'file',
                'filename': original_name,
                'content': data_part,
                'mime': mime
            })
        elif name_m:
            field_name = name_m.group(1).strip().strip('\'"')
            fields[field_name] = data_part.decode('utf-8', errors='replace')
            
    return files, fields


def send_verification_email(to_email, code):
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        return False, 'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.'
    message = EmailMessage()
    message['Subject'] = 'DebtEase verification code'
    message['From'] = SMTP_FROM
    message['To'] = to_email
    message.set_content(
        f"Your DebtEase verification code is: {code}\n\n"
        "Enter this 6-digit code on the DebtEase site to complete verification.\n"
        "If you did not request this, ignore the message."
    )
    message.add_alternative(
        f"<html><body><h2>DebtEase verification code</h2>"
        f"<p>Your code is <strong>{code}</strong></p>"
        f"<p>Enter it back in the DebtEase verification page to continue.</p>"
        f"</body></html>", subtype='html'
    )
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(message)
        return True, None
    except Exception as error:
        return False, str(error)


def load_json_file(filename):
    path = os.path.join(DIRECTORY, filename)
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except Exception:
        return None


def optimize_expenses_logic(expenses):
    # compute balances
    balances = {}
    for exp in expenses:
        pb = exp.get('paid_by')
        if not pb: continue
        if pb not in balances: balances[pb] = 0
        for p in exp.get('split_between', []):
            if p not in balances: balances[p] = 0
            
    for exp in expenses:
        pb = exp.get('paid_by')
        if not pb: continue
        total = float(exp.get('amount', 0))
        parts = exp.get('split_between', [])
        mode  = exp.get('split_mode', 'equal')
        det   = exp.get('split_details', {})
        
        balances[pb] += total
        
        if mode == 'exact' and det:
            for p, amt in det.items():
                balances[p] -= float(amt)
        elif mode == 'percent' and det:
            for p, pct in det.items():
                balances[p] -= (float(pct) / 100.0) * total
        else: # equal split
            if not parts: continue
            share = total / len(parts)
            for p in parts:
                balances[p] -= share
            
    # build raw graph
    nodes = set()
    links = []
    for exp in expenses:
        pb = exp.get('paid_by')
        if not pb: continue
        nodes.add(pb)
        total = float(exp.get('amount', 0))
        parts = exp.get('split_between', [])
        mode  = exp.get('split_mode', 'equal')
        det   = exp.get('split_details', {})
        
        if mode == 'exact' and det:
            for p, amt in det.items():
                nodes.add(p)
                if p != pb:
                    links.append({'source': p, 'target': pb, 'value': float(amt)})
        elif mode == 'percent' and det:
            for p, pct in det.items():
                nodes.add(p)
                if p != pb:
                    links.append({'source': p, 'target': pb, 'value': (float(pct) / 100.0) * total})
        else: # equal split
            if not parts: continue
            share = total / len(parts)
            for p in parts:
                nodes.add(p)
                if p != pb:
                    links.append({'source': p, 'target': pb, 'value': share})
    before_graph = {'nodes': [{'id': n} for n in nodes], 'links': links}
    
    # optimize
    creditors = []
    debtors = []
    for person, balance in balances.items():
        if balance > 0.01: creditors.append({'id': person, 'balance': round(balance, 2)})
        elif balance < -0.01: debtors.append({'id': person, 'balance': round(-balance, 2)})
        
    creditors.sort(key=lambda x: x['balance'], reverse=True)
    debtors.sort(key=lambda x: x['balance'], reverse=True)
    
    transactions = []
    steps = []
    step_index = 1
    
    if not creditors and not debtors:
        steps.append({'id': step_index, 'type': 'info', 'text': 'No imbalances found.'})
    else:
        steps.append({'id': step_index, 'type': 'info', 'text': f"Step 1: Computed net balances. Found {len(creditors)} creditors and {len(debtors)} debtors."})
        step_index += 1
        
        i = 0
        j = 0
        while i < len(debtors) and j < len(creditors):
            debtor = debtors[i]
            creditor = creditors[j]
            amount = round(min(debtor['balance'], creditor['balance']), 2)
            
            transactions.append({'source': debtor['id'], 'target': creditor['id'], 'amount': amount})
            steps.append({
                'id': step_index,
                'type': 'action',
                'text': f"Matched debtor {debtor['id']} (owed ₹{debtor['balance']}) with creditor {creditor['id']} (owed ₹{creditor['balance']}). Transferred ₹{amount}."
            })
            step_index += 1
            
            debtor['balance'] = round(debtor['balance'] - amount, 2)
            creditor['balance'] = round(creditor['balance'] - amount, 2)
            
            if debtor['balance'] == 0: i += 1
            if creditor['balance'] == 0: j += 1
            
        steps.append({'id': step_index, 'type': 'success', 'text': f"Algorithm complete. Minimized to {len(transactions)} transactions."})
        
    # calculate stats
    orig_count = len(before_graph['links'])
    opt_count  = len(transactions)
    save_pct   = round(((orig_count - opt_count) / max(orig_count, 1)) * 100, 1) if orig_count > 0 else 0
    if save_pct < 0: save_pct = 0 # should not happen with greedy

    return {
        'balances': balances,
        'before_graph': before_graph,
        'transactions': transactions,
        'steps': steps,
        'stats': {
            'original_tx_count': orig_count,
            'optimized_tx_count': opt_count,
            'reduction_pct': save_pct
        }
    }


def build_graph_data():
    """Calculates graph visualization data from live expenses.json instead of mock files."""
    expenses = load_json_file('expenses.json') or []
    result = optimize_expenses_logic(expenses)
    
    before_links = result.get('before_graph', {}).get('links', [])
    after_links = result.get('transactions', [])
    
    # Format for the Visualizer page's expectation if still needed
    # (Note: Visualizer.jsx now mostly uses /api/optimize directly)
    # But built-in /api/graph handler might still be used by old parts.
    
    before_edges = []
    for l in before_links:
        before_edges.append({
            'from': l['source'],
            'to': l['target'],
            'amount': round(l['value'], 2)
        })
        
    after_edges = []
    for l in after_links:
        after_edges.append({
            'from': l['source'],
            'to': l['target'],
            'amount': round(l['amount'], 2)
        })

    raw_nodes = set()
    for e in before_edges + after_edges:
        raw_nodes.add(e['from'])
        raw_nodes.add(e['to'])

    return {
        'before': {
            'edges': sorted(before_edges, key=lambda edge: edge['amount'], reverse=True)[:50],
            'node_count': len(raw_nodes)
        },
        'after': {
            'edges': sorted(after_edges, key=lambda edge: edge['amount'], reverse=True)[:50],
            'node_count': len(raw_nodes)
        },
        'summary': {
            'before_transactions': len(before_edges),
            'after_transactions': len(after_edges)
        }
    }


class DebtEaseHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def send_json_response(self, payload, status=200):
        self.send_response(status)
        self.set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.set_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path.startswith('/api/'):
            self.handle_api_request(parsed_path.path)
            return
        return super().do_GET()

    def handle_api_request(self, path):
        # Helper to get dynamic results from server-side expenses
        def get_current_calc():
            expenses = load_json_file('expenses.json') or []
            return optimize_expenses_logic(expenses)

        if path == '/api/balances':
            res = get_current_calc()
            return self.send_json_response(res.get('balances', {}))

        if path == '/api/settlements':
            res = get_current_calc()
            return self.send_json_response({
                'settlements': res.get('transactions', []),
                'total_transactions': len(res.get('transactions', []))
            })

        if path == '/api/summary':
            res = get_current_calc()
            balances = res.get('balances', {})
            total_balance = sum(abs(v) for v in balances.values()) / 2.0
            return self.send_json_response({
                'participants': len(balances),
                'total_balance': round(total_balance, 2),
                'total_transactions': len(res.get('transactions', [])),
                'data_source': 'Dynamic live calculation'
            })

        if path == '/api/features':
            return self.send_json_response({
                'features': [
                    {
                        'title': 'Net balance analysis',
                        'description': 'DebtEase converts shared expenses into a clear owed/owing summary for every participant.'
                    },
                    {
                        'title': 'Minimized settlement plan',
                        'description': 'The app reduces redundant transfers and creates a compact payment graph for faster reconciliation.'
                    },
                    {
                        'title': 'Before/after comparison',
                        'description': 'Compare chaotic original expense splits with the optimized set of real transfers.'
                    }
                ]
            })

        if path == '/api/graph':
            return self.send_json_response(build_graph_data())

        if path == '/api/expenses':
            expenses_path = os.path.join(DIRECTORY, 'expenses.json')
            if os.path.exists(expenses_path):
                try:
                    with open(expenses_path, 'r', encoding='utf-8') as f:
                        all_expenses = json.load(f)
                    return self.send_json_response({'expenses': all_expenses, 'count': len(all_expenses)})
                except Exception:
                    pass
            return self.send_json_response({'expenses': [], 'count': 0})

        if path == '/api/documents':
            meta = load_vault_meta()
            return self.send_json_response({'documents': meta, 'count': len(meta)})

        if path.startswith('/api/download/'):
            filename = unquote(path[len('/api/download/'):])
            # Sanitise: no path traversal
            filename = os.path.basename(filename)
            filepath = os.path.join(VAULT_DIR, filename)
            if not os.path.exists(filepath):
                return self.send_error(404, 'File not found')
            mime, _ = mimetypes.guess_type(filepath)
            mime = mime or 'application/octet-stream'
            with open(filepath, 'rb') as fh:
                data = fh.read()
            self.send_response(200)
            self.set_cors_headers()
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Content-Disposition', f'inline; filename="{filename}"')
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, 'API endpoint not found')

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length)

        # ── /api/upload — binary multipart, handled before UTF-8 decode ──
        if self.path == '/api/upload':
            try:
                files, fields = parse_multipart(self.headers, body_bytes)
                if not files:
                    return self.send_json_response({'success': False, 'error': 'No file in upload'}, status=400)
                
                ensure_vault()
                
                uploaded_docs = []
                for file_info in files:
                    original_name = file_info['filename']
                    file_data = file_info['content']
                    mime = file_info['mime']

                    # Sanitise filename and make unique
                    safe_name   = re.sub(r'[^\w\s.\-]', '_', original_name)
                    ts          = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
                    uid         = uuid.uuid4().hex[:6]
                    stored_name = f'{ts}_{uid}_{safe_name}'
                    dest        = os.path.join(VAULT_DIR, stored_name)
                    
                    with open(dest, 'wb') as fh:
                        fh.write(file_data)
                    
                    ext = original_name.rsplit('.', 1)[-1].lower() if '.' in original_name else 'bin'
                    
                    doc_entry = {
                        'id':            uuid.uuid4().hex,
                        'original_name': original_name,
                        'stored_name':   stored_name,
                        'file_type':     ext,
                        'mime_type':     mime,
                        'file_size':     len(file_data),
                        'upload_date':   datetime.now(timezone.utc).isoformat(),
                        'category':      fields.get('category', 'general'),
                        'title':         fields.get('title', original_name),
                        'description':   fields.get('description', ''),
                        'participants':  json.loads(fields.get('participants', '[]')),
                        'is_encrypted':  fields.get('is_encrypted', 'false') == 'true'
                    }
                    uploaded_docs.append(doc_entry)
                
                meta = load_vault_meta()
                meta.extend(uploaded_docs)
                save_vault_meta(meta)
                
                return self.send_json_response({'success': True, 'documents': uploaded_docs})
            except Exception as err:
                return self.send_json_response({'success': False, 'error': str(err)}, status=400)

        # All other POST endpoints use JSON
        body = body_bytes.decode('utf-8')
        
        if self.path == '/api/optimize':
            try:
                data = json.loads(body)
                expenses = data.get('expenses', [])
                result = optimize_expenses_logic(expenses)
                self.send_json_response(result)
            except Exception as error:
                self.send_error(500, str(error))
            return

        if self.path == '/api/net-balances':
            try:
                data = json.loads(body)
                expenses = data.get('expenses', [])
                result = optimize_expenses_logic(expenses)
                balances = result.get('balances', {})
                transactions = result.get('transactions', [])

                # Build formatted rows
                rows = []
                total_receivable = 0.0
                total_payable = 0.0
                for name, bal in balances.items():
                    abs_bal = abs(bal)
                    if bal > 0.01:
                        status = 'creditor'
                        total_receivable += bal
                    elif bal < -0.01:
                        status = 'debtor'
                        total_payable += abs_bal
                    else:
                        continue  # skip settled
                    rows.append({
                        'name': name,
                        'balance': round(bal, 2),
                        'absBalance': round(abs_bal, 2),
                        'status': status,
                    })

                # Sort by absBalance descending by default
                rows.sort(key=lambda r: r['absBalance'], reverse=True)

                self.send_json_response({
                    'balances': balances,
                    'rows': rows,
                    'transactions': transactions,
                    'summary': {
                        'totalReceivable': round(total_receivable, 2),
                        'totalPayable': round(total_payable, 2),
                        'settlementsNeeded': len(transactions),
                        'creditorCount': sum(1 for r in rows if r['status'] == 'creditor'),
                        'debtorCount': sum(1 for r in rows if r['status'] == 'debtor'),
                    },
                })
            except Exception as error:
                self.send_error(500, str(error))
            return

        if self.path == '/api/add-expense':
            try:
                data = json.loads(body)
                expense = data.get('expense', {})
                if not expense:
                    raise ValueError('No expense data provided')

                # Load existing server-side expenses (separate from localStorage)
                expenses_path = os.path.join(DIRECTORY, 'expenses.json')
                if os.path.exists(expenses_path):
                    with open(expenses_path, 'r', encoding='utf-8') as f:
                        all_expenses = json.load(f)
                else:
                    all_expenses = []

                # Check for duplicate id
                existing_ids = {e.get('id') for e in all_expenses}
                if expense.get('id') not in existing_ids:
                    all_expenses.append(expense)
                    with open(expenses_path, 'w', encoding='utf-8') as f:
                        json.dump(all_expenses, f, indent=2, ensure_ascii=False)

                # Recalculate balances with new expense included
                result = optimize_expenses_logic(all_expenses)

                self.send_json_response({
                    'success': True,
                    'expense_id': expense.get('id'),
                    'total_expenses': len(all_expenses),
                    'balances': result.get('balances', {}),
                    'transactions': result.get('transactions', []),
                    'message': f"Expense '{expense.get('description', '')}' saved successfully",
                })
            except Exception as error:
                self.send_json_response({'success': False, 'error': str(error)}, status=400)
            return

        if self.path == '/api/expenses':
            # Return all server-side stored expenses
            try:
                expenses_path = os.path.join(DIRECTORY, 'expenses.json')
                if os.path.exists(expenses_path):
                    with open(expenses_path, 'r', encoding='utf-8') as f:
                        all_expenses = json.load(f)
                else:
                    all_expenses = []
                self.send_json_response({'expenses': all_expenses, 'count': len(all_expenses)})
            except Exception as error:
                self.send_json_response({'expenses': [], 'error': str(error)})
            return

        if self.path == '/api/reset':
            try:
                expenses_path = os.path.join(DIRECTORY, 'expenses.json')
                with open(expenses_path, 'w', encoding='utf-8') as f:
                    json.dump([], f)
                self.send_json_response({'success': True, 'message': 'Server data wiped'})
            except Exception as error:
                self.send_error(500, str(error))
            return

        if self.path == '/send-code':
            try:
                data = json.loads(body)
                email = data.get('email')
                code = data.get('code')
                if not email or not code:
                    raise ValueError('Missing email or code')
                success, error = send_verification_email(email, code)
                if not success:
                    raise RuntimeError(error)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            except Exception as error:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(error)}).encode('utf-8'))
            return

        self.send_error(404, 'Not Found')

    def do_DELETE(self):
        self.send_response(200)
        self.set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        if self.path.startswith('/api/documents/'):
            stored_name = unquote(self.path[len('/api/documents/'):])
            stored_name = os.path.basename(stored_name)  # prevent traversal
            try:
                meta     = load_vault_meta()
                new_meta = [d for d in meta if d.get('stored_name') != stored_name]
                save_vault_meta(new_meta)
                filepath = os.path.join(VAULT_DIR, stored_name)
                if os.path.exists(filepath):
                    os.remove(filepath)
                self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            except Exception as err:
                self.wfile.write(json.dumps({'success': False, 'error': str(err)}).encode('utf-8'))
        else:
            self.wfile.write(json.dumps({'success': False, 'error': 'Unknown endpoint'}).encode('utf-8'))

    def log_message(self, format, *args):
        return


def main() -> None:
    os.chdir(DIRECTORY)
    handler = DebtEaseHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving DebtEase at {URL}")
        if SMTP_HOST:
            print(f"Email sending enabled via {SMTP_HOST}:{SMTP_PORT}")
        else:
            print("Email sending disabled. Configure SMTP_HOST, SMTP_USER, SMTP_PASS to enable.")
        try:
            webbrowser.open(URL)
        except Exception:
            pass
        httpd.serve_forever()


if __name__ == '__main__':
    main()
