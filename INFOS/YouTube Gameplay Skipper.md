### USE CASE:
--------------
Skip the intros of gameplay videos and go straight into the action (most of the times). 
Can be personalized to skip more or less time.

### USAGE:
---------------
Just try to watch any video whose title contains the words/phrases "gameplay", "longplay" or "no commentary".
To customize the skip time, open the code of the script in violentmonkey (or your userscript manager)
and edit these lines:

⚠ FOLLOW THE FORMAT!! (e.g. do not add a comma at the end of the last word & don't forget the semicolon at 
the end of each line)

```
const SKIP_TIME = 120; // 2 minutes in seconds
const TARGET_WORDS = ['gameplay', 'longplay', 'no commentary']; // Words to detect in title
```


### WHY?:
---------------
I was tired of wasting my time with the youtuber's showing their own intros plus the intros of the games and then
the options he sets and the whole thing taking even more time when the youtuber stops to read what the heck he is 
doing (reading menus, popups or just useles lore of the game). This extension aims to make viewers life %0,00000001
less miserable.
