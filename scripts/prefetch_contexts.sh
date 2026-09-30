#!/bin/bash

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Define the base URL for the API
API_URL="https://shiny.ens-paris-saclay.fr/guni/api/context"
OUTPUT_DIR="$PROJECT_ROOT/public/contexts"
OCCURRENCES_FILE="$PROJECT_ROOT/public/occurrences_exemple.json"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Please install it first."
    exit 1
fi

# Extract relevant data from occurrences_exemple.json using jq
# We need ark, url, terms, and date for each record
# We process each record and make the API call
echo "Reading occurrences from $OCCURRENCES_FILE..."

# Read the JSON file and iterate over records
jq -c '.records[]' "$OCCURRENCES_FILE" | while read -r record; do
    # Extract fields
    ark=$(echo "$record" | jq -r '.ark')
    url=$(echo "$record" | jq -r '.url')
    # terms is an array, we take the first term and split by '+' as done in the app logic
    term=$(echo "$record" | jq -r '.terms[0]' | cut -d'+' -f1)
    date=$(echo "$record" | jq -r '.date')
    
    echo "Processing ARK: $ark"
    
    # Construct the API URL with parameters
    # Note: ensureMultiWordIsWrapped logic in Occurrence.js wraps multi-word terms in quotes
    # But here 'term' is a single string. If it contains spaces, we might need quotes.
    # The app code: t.trim().split(' ').length > 1 ? `"${t.trim()}"` : t.trim()
    
    # Check if term has spaces
    if [[ "$term" == *" "* ]]; then
        encoded_term="\"$term\""
    else
        encoded_term="$term"
    fi
    
    # URL encode the parameters (basic encoding for spaces/quotes)
    # Using python for reliable urlencoding if available, otherwise simple sed
    if command -v python3 &> /dev/null; then
        encoded_term=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$encoded_term")
        encoded_url=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$url")
        encoded_ark=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$ark")
    else
        # Fallback simplistic encoding
        encoded_term=$(echo "$encoded_term" | sed 's/ /%20/g' | sed 's/"/%22/g')
    fi

    # Construct the full URL
    # Assuming 'presse' corpus behavior (adding source=periodical if not present, though app logic varies)
    # The app adds resolution params (month/day) if resolution is mois/jour, but initial query is usually 'annee'
    # occurrences_exemple.json doesn't show resolution field, defaults to 'annee' in SpecialContextDisplay logic
    # but Occurrence.js uses passed 'resolution' prop. 
    # For liberte_data.csv, resolution is 'annee'.
    
    # Standard params from Occurrence.js: ark, url, terms, source=periodical (for presse)
    FETCH_URL="$API_URL?ark=$ark&url=$url&terms=$encoded_term&source=periodical"
    
    echo "Fetching: $FETCH_URL"
    
    # Curl the data
    curl -s "$FETCH_URL" -o "$OUTPUT_DIR/$ark.json"
    
    if [ $? -eq 0 ]; then
        echo "Successfully saved to $OUTPUT_DIR/$ark.json"
    else
        echo "Failed to fetch $ark"
    fi
    
    # Be nice to the server
    sleep 0.5
done

echo "Done!"
