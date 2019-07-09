# Usage
**Display Whisper** is for presenting songs, text, and images.  

In the Control window, there are 4 main sections:  
The _Add_ panel is on the left, which has tabs for adding [song](#adding-songs), [text](#adding-text), [image](#adding-images), and [PDF](#adding-pdfs) items to the _Presentation_.  
The _Presentation_ lists are in the center, which shows all items in the _Presentation_. Controls for displaying or modifying lists, and items within them, are shown here.  
The _Previews_ are on the right, and show where you are in the _Presentation_.  

You can view this help at any time by selecting _Help_ > _Help_ from the _Menu_ in the Control window.

# Adding items
When adding an item to the _Presentation_, a [template](#templates) will be applied. The currently selected template is shown at the bottom of the _Add_ tab.  
After being added, items in the _Presentation_ can be modified by clicking their _Edit_ (![edit](#edit)) button in the _Presentation_ list.

## Adding Songs
View the [Songs](#songs) help section for information on adding or changing songs in the song library.

To search for a specific song, use the _Search_ box. Results will appear below. You can chose how results are filtered by clicking the _settings_ (![settings](#settings)) button and changing how song results are filtered.  
To add a song to the _Presentation_, click & drag it from the _Results_ list into a _Presentation_ list. You can also select a result by clicking on it, and then click the _Add_ button at the bottom of the _Song_ tab to add the selected song to the end of the selected _Presentation_ list.

## Adding Text
In the _Text_ tab, you can enter text and change it's appearance.  
To add the text to the _Presentation_, click the _Add_ button at the bottom of the _Text_ tab. This will append it to the end of the selected _Presentation_ list. If you want to insert it to a specific location within a _Presentation_ list, click and drag the _Add_ button into a _Presentation_ list.

## Adding Images
In the _Image_ tab, you can choose an image and change it's appearance.  
To add the image to the _Presentation_, click the _Add_ button at the bottom of the _Image_ tab. This will append it to the end of the selected _Presentation_ list. If you want to insert it to a specific location within a _Presentation_ list, click and drag the _Add_ button into the _Presentation_ list.  
To add multiple images at the same time, click the _Add Multiple_ button and select image files. They will all be appended to the end of the selected _Presentation_ list.

## Adding PDFs
In the _PDF_ tab, you can choose a PDF file and the background for it.  
To add the PDF to the _Presentation_, click the _Add_ button at the bottom of the _PDF_ tab. This will append it to the end of the selected _Presentation_ list. If you want to insert it to a specific location within a _Presentation_ list, click and drag the _Add_ button into the _Presentation_ list.

# Presentation Items & Sections
When you have added items to the _Presentation_, the _Presentation_ lists will display each item and it's sections.  
An item is a element within the _Presentation_ and is either a song, text/image, or PDF.
Sections are individual parts within an item, which can be displayed.
Items in the _Presentation_ are added, moved, removed, and edited as a single element containing all their sections.
Sections can be selected (which will also select the whole item) and displayed.

# Modifying Presentation
Items which have multiple sections can be expanded (![expand](#expand-x)) or minimized (![expand-y](#expand-y)) to hide the sections.

Each item has three buttons:  
_Move_ (![move](#move-y)), which can be used to reorder items within a _Presentation_ list.  
_Edit_ (![edit](#edit)), which can be used to modify the contents and appearance of items.  
_Remove_ (![remove](#remove)), which removes the item from the _Presentation_.  

Individual sections each have a _Preview_ display, _Display_ (![play](#play)) button, and _Content_ information. Clicking on a section will select it.

# Presenting
To display a section, click the _Display_ (![play](#play)) button next to its _Preview_.  
You can move to the next or previous section with the _Next_ (![next](#play-next)), and _Previous_ (![previous](#play-previous)) buttons in the _Presentation List Controls_, or by using keyboard shortcuts (`control.keyboard.playNext` and `control.keyboard.playPrevious` respectively).

The **Displayed** section is shown with a highlighted _Display_ (![play](#play)) button.  
The **Selected** section is shown with a blue highlight.

Sections can be selected by clicking on the _Preview_ or _Content_, and by using the **Select Previous** (`control.keyboard.selectPrevious`) and **Select Next** (`control.keyboard.selectNext`) keyboard shortcuts.  
The selected section can be displayed with the **Display Selected** (`control.keyboard.playSelected`) shortcut.  
Displaying a section will automatically select it.

Sections can automatically advance after a set amount of time. The _Timer_ in the the _Presentation List Controls_ will show when this happens.
To stop automatic advancing, set the _Play Mode_ to _Manual_ in the _Presentation List Controls_.

# Program information
**Display Whisper** will automatically check for updates, and notify you when one is available. You can also manually check if there is a new version by selecting _Help_ > _Check For Updates_ from the _Menu_ in the Control window.  
To see what version you are using and other information such as licenses, select _Help_ > _About_ from the _Menu_ in the Control window.  
**Display Whisper** uses **Electron**.
The versions of **Node**, **Electron**, and **Chromium** used are shown in the _About_ window.

## Reporting Issues
You can report issues, or suggest improvements by selecting _Help_ > _Report Issue_ from the _Menu_ in the Control window.  
The _GitHub_ option will send you to the **Display Whisper** repository. You will need to have a GitHub account in order to create an issue.  
The _Email_ option will open your default email program, with the email address for **Display Whisper**.