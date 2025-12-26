# Gallica corpora (Presse de Gallica, Livres de Gallica, Journal de Paris, Moniteur Universel, Journal des Débats, La Presse, Le Constitutionnel, Le Figaro, Le Temps, Le Petit Journal, Le Petit Parisien, L'Humanité)
* We will use the current implementation, with https://gallica-proxy-production.up.railway.app/api
* For each corpus, add to the url the parameters that I put in the public/corpus.tsv file, in the 'Gallica_context_filter' column. It adds a source (periodical or books), and for some corpora, a 'codes' parameter.
* Proceed as before, using src/Occurrence.js and src/ContextDisplay.js 

# Le Monde

* Depending on the time resolution chosen (day, month, year), construct the relevant time range, and create variables for start_day, start_month, start_year, end_day, end_month and end_year. If several words are searched (with a + operator in the query), then only take the first.
* Build the following url: https://www.lemonde.fr/recherche/?search_keywords=%22{word}%22&start_at={start_day}%2Fs{start_month}%2F{start_year}&end_at={end_day}%2F{end_month}%2F{end_year}
* Take the source code of the web page
* Get the bit <section class="js-river-search"
* In that section, take all the ‘a’ tags, and make a list associated the link (‘href’) and the title (‘teaser__title’).
* In the context box, list the titles, with url in hyperlinks. 
* On top of the context box, put a link to the search url constructed above, with as title ‘All documents’ (in the French translation of the app, 'Tous les documents'). 


# Persée
* This corpus only has a yearly resolution, so the only relevant parameters are the word that you search and the year. If several words are searched (with a + operator in the query), then only take the first. 
* Construct the url this way: https://www.persee.fr/search?l=fre&da={year}&q=%22{word}%22
* Take this section: <div id="content-search-results"
* Inside the section, isolate each <div class="doc-result", to get a snippet of code for each document.
* For each document, extract the tag <a class="title title-free" and get its href and its associated text. Concretely, the code looks like:  <div class="doc-result"> <div> <a href="{url}" class="title title-free">{title}</a>.
* Extract the informations: author, collection and search context. The html is structured this way: <span class="name"> A. Birembaut</span></a></span> </div> <div class="documentBibRef"> <span class="collection"> <a href="https://www.persee.fr/collection/ahrf">Annales historiques de la Révolution française</a></span> / <span class="documentYear"> Année 1959</span> / <span class="documentIssue"> <a href="https://www.persee.fr/issue/ahrf_0003-4436_1959_num_158_1?sectionId=ahrf_0003-4436_1959_num_158_1_4814_t1_0376_0000_2">158</a></span> / <span class="documentPageRange"> pp. 376-382</span> </div> <div class="searchContext"> <p>Roland Mousnier, <i>Progrès scientifique et technique au XVIIIe siècle</i>. Plon, collection <em>Civilisations</em> d’hier et d’aujourd’hui, 1958
* On top of the context box, put a link to the search url constructed above, with as title ‘All documents’ (in the French translation of the app, 'Tous les documents'). 

# Rap français (Genius)
* This corpus only has a yearly resolution, so the only relevant parameters are the word that you search and the year.
* Build the url this way: https://shiny.ens-paris-saclay.fr/guni/source_rap?mot={mot}&year={year}
* Fetch the url, the response is in csv, store the results in a table. Reorder the table using the column "counts", descending order.
* In the context box the table with all the columns.
* On top of the context box, put "Corpus" with the hyperlink to https://huggingface.co/datasets/regicid/LRFAF.

# Other corpora
For all other corpora, put "We do not handle the context (yet?) for this corpus". In the French translation: "Nous ne pouvons pour le moment pas vous offrir le contexte pour ce corpus.


