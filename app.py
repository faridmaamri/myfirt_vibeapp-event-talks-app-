import os
import time
import json
import requests
import re
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

CACHE_FILE = 'cache.json'
CACHE_DURATION = 300  # 5 minutes in seconds
FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

# Standard headers to look like a browser request
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def clean_html_content(soup):
    """
    Clean up links and formatting in HTML to make it safe and consistent.
    Ensure all links open in a new tab.
    """
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
        # Add class for modern link styling
        a['class'] = a.get('class', []) + ['release-link']
    return str(soup)

def parse_xml_feed(xml_content):
    """
    Parse the Atom XML feed and extract individual release updates.
    """
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        print(f"XML Parsing Error: {e}")
        return []
        
    entries = []
    
    for entry_el in root.findall('atom:entry', namespaces):
        # Extract title (usually the date, e.g. "June 17, 2026")
        title_el = entry_el.find('atom:title', namespaces)
        date_text = title_el.text.strip() if title_el is not None and title_el.text else "Unknown Date"
        
        # Extract updated timestamp
        updated_el = entry_el.find('atom:updated', namespaces)
        updated_text = updated_el.text.strip() if updated_el is not None and updated_el.text else ""
        
        # Extract link
        link_el = entry_el.find("atom:link[@rel='alternate']", namespaces)
        if link_el is None:
            link_el = entry_el.find("atom:link", namespaces)
        link_href = link_el.attrib.get('href', '') if link_el is not None else ""
        
        # Extract ID
        id_el = entry_el.find('atom:id', namespaces)
        entry_id = id_el.text.strip() if id_el is not None and id_el.text else ""
        
        # Extract content (HTML)
        content_el = entry_el.find('atom:content', namespaces)
        content_html = content_el.text if content_el is not None and content_el.text else ""
        
        if not content_html:
            continue
            
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Find headers to split entries
        # Google release notes format: <h3>Feature</h3>, <h3>Announcement</h3>, <h3>Issue</h3>, etc.
        headers = soup.find_all(re.compile('^h[1-6]$'))
        
        if not headers:
            # Fallback if there are no subheaders inside the content
            text_content = soup.get_text(separator=' ').strip()
            # Clean single content HTML
            cleaned_html = clean_html_content(soup)
            
            entries.append({
                'id': entry_id,
                'date': date_text,
                'updated': updated_text,
                'link': link_href,
                'type': 'Update',
                'content_html': cleaned_html,
                'content_text': text_content
            })
        else:
            # Segment the entry by headers
            for idx, header in enumerate(headers):
                update_type = header.get_text().strip()
                
                sibling_html = []
                sibling_text = []
                curr = header.next_sibling
                
                # Walk siblings until next header
                while curr:
                    if curr.name and re.match('^h[1-6]$', curr.name):
                        break
                    
                    if curr.name:
                        # Clone tag or extract it to prevent mutations
                        tag_str = str(curr)
                        sibling_html.append(tag_str)
                        sibling_text.append(curr.get_text().strip())
                    elif isinstance(curr, str) and curr.strip():
                        sibling_html.append(curr)
                        sibling_text.append(curr.strip())
                        
                    curr = curr.next_sibling
                
                segment_raw_html = "".join(sibling_html).strip()
                segment_soup = BeautifulSoup(segment_raw_html, 'html.parser')
                cleaned_segment_html = clean_html_content(segment_soup)
                segment_text = " ".join(sibling_text).strip()
                
                # Generate a sub-id for uniqueness
                sub_id = f"{entry_id}#{update_type.lower()}_{idx}"
                
                entries.append({
                    'id': sub_id,
                    'date': date_text,
                    'updated': updated_text,
                    'link': f"{link_href}#{date_text.replace(' ', '_')}" if link_href else "",
                    'type': update_type,
                    'content_html': cleaned_segment_html,
                    'content_text': segment_text
                })
                
    return entries

def get_release_notes(force_refresh=False):
    """
    Get release notes from cache or fetch from feed URL.
    """
    current_time = time.time()
    
    # Check if cache is valid and we aren't forcing refresh
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                cache_data = json.load(f)
                
            cache_time = cache_data.get('timestamp', 0)
            if current_time - cache_time < CACHE_DURATION:
                print("Serving releases from cache...")
                return cache_data.get('releases', []), False
        except Exception as e:
            print(f"Error reading cache: {e}")
            
    # Cache invalid or force refresh: Fetch fresh data
    print("Fetching fresh release notes...")
    try:
        response = requests.get(FEED_URL, headers=HEADERS, timeout=15)
        response.raise_for_status()
        
        releases = parse_xml_feed(response.text)
        
        # Save to cache
        cache_data = {
            'timestamp': current_time,
            'releases': releases
        }
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache_data, f, indent=2)
            
        return releases, True
    except Exception as e:
        print(f"Error fetching/parsing feed: {e}")
        
        # Fallback to expired cache if available
        if os.path.exists(CACHE_FILE):
            try:
                print("Falling back to expired cache due to fetch error.")
                with open(CACHE_FILE, 'r') as f:
                    cache_data = json.load(f)
                return cache_data.get('releases', []), False
            except:
                pass
                
        # If absolutely nothing works, return empty list and error
        return [], False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    releases, fetched_fresh = get_release_notes(force_refresh)
    
    if not releases:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve release notes. Please check connection and try again.'
        }), 500
        
    return jsonify({
        'status': 'success',
        'fetched_fresh': fetched_fresh,
        'count': len(releases),
        'releases': releases
    })

if __name__ == '__main__':
    # Default Flask runs on port 5000
    app.run(debug=True, port=5000)
