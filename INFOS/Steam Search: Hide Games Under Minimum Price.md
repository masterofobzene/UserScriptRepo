### USE CASE:
--------------
⚠ If prices are not in US dollars this extension requires you to either install [Force Steam US Dollars](https://github.com/masterofobzene/UserScriptRepo/raw/refs/heads/main/SFW/Force%20Steam%20US%20Dollars.user.js)
or manually modify it to set the correct prices in your local currency.

Filtering the search page to get a clean catalog. TL;DR: Now you have unlimited
tag filtering + minimum price filtering on Steam.

UPDATE 1.6: Now we show a steam throttling message. Steam Throttles our results becase we are hiding A LOT of results
too fast and consequently asking for more at a rate not considered normal for the servers. With this we: A- explain to 
the user why he is not seeing any more results suddenly, and B- We stop him (with a warning only) from scrolling and tell
him to wait 40 seconds before trying to scroll. Scrolling is how we tell steam to load more results, so we have to wait a
minute before continuing.
__TIP:__ If you use the steam filters to take out more games that can appear on the search, you will likely avoid the throttling
since you will not have to remove thousands of games, but as you know, tags are abused and you could be removing more than
you want with them.

### USAGE:
---------------
On the right of your usual Steam search menu, you will find a new box to set a MINIMUM PRICE 
to show games; by rising this bar you will filter cheaper (mostly trash) games. It also has
one option to filter out games with "mixed/mostly negative" reviews and one to filter games
without reviews (⚠ warning as this last option will filter new games until they start getting 
reviewed).

### WHY?:
---------------
Steam is full of trash games. It is a sewer. "Troll games" everywhere, priced $0.80 and such. 
It was impossible to browse the catalog like that, so I did what Steam ACTIVELY REFUSED to do:
I created the [long-waited MINIMUM PRICE filter](https://www.reddit.com/r/Steam/comments/h9y1fb/maybe_unpopular_opinion_game_search_needs_minimum/) that we all have been waiting. To extend its 
functionalities, I added further filters by using the reviews system. 
If you are thinking "why don't you simply use steamdb?" I answer you: steamdb has a hard-limit
on tags you can filter, meaning it is also useless. 
Enjoy browsing a clean, completely filtrable Steam catalog now!

---------------
[INSTALL LINK](https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--Steam%20Search-%20Hide%20Games%20Under%20Minimum%20Price--.user.js)
You must have violentmonkey installed for this to work.
