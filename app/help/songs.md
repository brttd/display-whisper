# Song Section Splitting & Sizing
Song content (verses, choruses, etc) can be split into multiple parts, and sized using the same options as all Text items. More information is available in the [Text Sizing](#text-sizing) help.

# Special Song Sections
A song item in the presentation will show its content as listed in its play order. Songs items can also include special sections:
* **Blank**: An empty section.
* **Intro**: An introductory section, normally showing the name and author of the song.
* **Outro**: A concluding section, normally showing the name, copyright, and author of the song.

Each of these sections can be added or removed from the song item from within its editor.  
When adding a song item to the presentation, these section can be automatically added to the start and end of the song.  
By default a **Blank** section will be added at the start and end. This can be changed in the Preferences, under _Songs_ > _Play Order_.  
If **Add intro section** is enabled it will add the intro section to the start of the song. If **Add blank section at start** is enabled, the intro section will be added after the blank section.  
If **Add outro section** is enabled it will add the outro section to the end of the song. If **Add blank section at end** is enabled, the outro section will be added before the blank section.

The text in the **Intro** and **Outro** use [Text expressions](#song-text-expressions).

# Section & End Overlays
Song items have two special text elements, the _Section_ and _End_ overlay.  
These (when enabled) are shown in addition to the main text content of the song, and show where in the song the current section is.  
The _Section_ overlay is shown on every song content section (Every section except for **Blank**, **Intro**, and **Outro**).  
The _End_ overlay is shown on the last song content section.

Both _Section_ and _End_ overlay elements use [Text expressions](#song-text-expressions).

# Song Text Expressions
**Intro** & **Outro** sections and _Section_ & _End_ overlay elements can use song text expressions.  

These are small bits of text in the text elements, which will display song information automatically.  
This is to make it easier when creating templates or modifying song items. Instead of manually entering data already in the song, special text phrases can be used. When displayed, these will be replaced with the relevant song data.  
This means a template can use the text **"{author}"** in the **Intro** text element, and when a song item uses that template the actual song author will be shown in its place.

>**Note:**  
The expressions are not case-sensitive, but must include every character from (and including) the opening **"{"** to the closing **"}"**.  
Song text elements can have any text in them, only when a valid expression is found will the text be modified.

The song expressions are:
* **"{name}"**: Displays the name of the song.
* **"{author}"**: Displays the author of the song.
* **"{copyright}"**: Displays the copyright of the song.

The _Section_ overlay element has special expressions used to differentiate between sections, and parts within a section which has been split (when using the _Max lines_ option):
* **"{section}"**: Displays the section name.
* **"{index}"**: Displays the position (index number) the section is at in the play order (ignoring **Blank**, **Intro**, and **Outro** sections).
* **"{total}"**: Displays the total amount of sections in the play order (ignoring **Blank**, **Intro**, and **Outro** sections).
* **"{sectionParts}"**: Displays the amount of parts which the section was split into (when using the _Max lines_ option) (If _Max lines_ is 0, or not split, will be "1").
* **"{sectionPart}"**: Displays the position (index number) of the part in the split section (If _Max lines_ is 0, or not split, will be "1").
* **"{sectionSplit}"**: Displays **"{sectionPart}/{sectionParts}"** if the section has been split into multiple parts, otherwise displays nothing.

>**Note:**  
Only text elements in the **Intro** & **Outro** sections, and _Section_ & _End_ overlay elements can use song text expressions.  
Text in song content (verses, choruses, etc) cannot use text expressions.

>**Note:**  
If a text expression is invalid, then it will be shown without any replacement.
Any expression which doesn't have the correct expression name (listed above) is invalid.  
For example, **"{null}"** would be shown with no change.

## Expression Fallbacks
Text expressions can include a fallback option, which is displayed when the referenced information is empty.  
The fallback is set by including a ":" after the expression name, and then the replacement text. For example:  
**"{copyright:No Copyright}"**  
When used in a song with no text in its copyright property, the above expression would display "No Copyright".

Anytime an expression is used, if the referenced value is empty (containing no text characters), fallback text (if present) will be displayed instead. All text after the **":"** character and before the closing **"}"** character is used.
If no fallback is specified, then the referenced empty value is used.

>**Note:**  
Space characters (**" "**) will be ignored when checking if a text expression value is empty or not.

>**Note:**  
To provide warning when a song in the playlist might be using a expression which references no actual text information, a notification is shown in the Control window when a song is added to the playlist, and it does not have any text for its name, author, or copyright. This can be changed in Preferences, under _Songs_ > _Missing Information_ > _Show warning..._  
Another tool to fix songs with incomplete information is the [Check Songs](#checking-songs) tool. 

# Viewing & Editing Songs
Select _Library_ > _Songs_ from the _Menu_ in the Control window, or _Song Library_ from the _Menu_ in any song window.

On the left, you can search for songs. Select a song from the results by clicking on it to show its data, which can then by edited.

If you want to remove a song from the song library, select it and click the _Remove_ button.

## Checking Songs
Select _Tools_ > _Check Songs_ from the _Menu_ in the Control window, or from the _Menu_ in the Song Library window.

This will show a list of songs with invalid, or empty song information. At the top are three options, which will display different groups of songs.
* **Important**:
    Shows songs which have invalid, or no entry for important song information (Such as having no play order).
* **All**:
    Shows all the songs from **Important**, in addition to songs which have empty (no text characters) for their *Name*, *Author*, or *Copyright*  information.
* **Invalid Files**:
    Shows files in the song library which have been corrupted. These files do not show up in song lists, as they cannot be properly loaded or used.

For both **Important** and **All** options, clicking a song from the list will open it in the Song Library window. You can then add any missing information.  
For the the **Invalid Files** option, clicking an item in the list will give two options for dealing with the corrupted file:
* **Open**: Will open the actual file, allowing you to extract any existing song content, which can then be added back to the Song Library.
* **Delete**: Will delete the file.

The **Fix Missing** button will automatically fix all issues show in the **Important** song list. Each song with invalid or missing song information will have it set to a blank value.

## Song IDs
Each song is assigned a unique ID, which is composed of a **Group** (one or more characters) followed by three numbers (**Group ID**). The ID is used for storing references to specific songs, and cannot be changed once a song is added to the library.  
The default group ID is "S". You can use the group ID to signify different song collections.

# Adding Songs To Library

## Importing
Select _Tools_ > _Import Songs_ from the _Menu_ in the Control window, or from the _Menu_ in the Song Library window.  
Click the _Import_ button, and select the file. When finished importing, a count of how many songs were imported will be shown, and any errors.  
If the file includes ID data, you can choose to either _Replace_ or _Add_ existing songs which have the same IDs as those being imported.

## Adding Manually
Select _Tools_ > _Add Song_ from the _Menu_ in the Control window, or from the _Menu_ in the Song Library window.

If you have a text file with song data in it, use the _Select File_ option. **Display Whisper** will then try to extract all song data and content from the file.  
A line starting with **"name:"**, **"author:"**, or **"copyright:"** will be used for the respective properties. All other text will be used as section content, shown in the _Source_ input.

The _Source_ input is for quickly converting song lyrics from text into separate sections. You can type or paste lyrics into it, and then extract sections with the _Update_ button. It will find different sections by looking for **"Verse"**, **"Chorus"**, or empty lines.  
Each section can then be modified individually, and removed or reordered.

>**Note:**  
Using the _Select File_ or _Source_ _Update_ option will overwrite all changes you've made to sections.

When all song data and content has been entered, click the _Add_ button. The song with then be added to the song library.  
By default the song will be assigned an ID with the group "S". This can be changed by entering a different value in the _Group_ input.

## Exporting
Select _Tools_ > _Export Songs_ from the _Menu_ in the Control window, or from the _Menu_ in the Song Library window.

Click the _Export_ button, and select a file location to save the exported songs to. All songs in the library will then be saved into the file, which can then be imported into a different **Display Whisper** installation.

>**Note:**  
If the _Export_ button is disabled, the songs are still being loaded.  
Wait until the song count is shown below the button, at this point you will be able to export.