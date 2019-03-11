# Usage
**Display Whisper** is for presenting songs, text, and images.  

In the Control window, there are 4 main sections:  
The _Add_ panel is on the left, and contains tabs for adding [songs](#adding-songs), [text](#adding-text), and [images](#adding-images) to the presentation.  
The _Presentation_ list is in the center, and shows all items in the presentation. The list contains previews and information for each item in the presentation, and controls for changing the list.  
Below the _Presentation_ list are _Presentation Controls_. These are controls and options for moving through the presentation.  
The _Previews_ are on the right, and show where you are in the presentation. This allows you to see what will be displayed before you move to it, or enable the display.  
The _Display Menu_ is at the top, and contains controls for enabling & disabling the [display](#presentation), and switching which screen is used for displaying.

You can view this help at any time by selecting _Help_ > _Help_ from the _Menu_ in the Control window.

# Adding items
Each different type of item has its own method & options for being added to the presentation, explained below.  
When adding an item to the presentation, a [template](#templates) will be applied. The currently selected template is shown at the bottom of the _Add_ tab.  
Items in the presentation can be modified by clicking the _Edit_ (![edit](#edit)) button next to them in the _Presentation_ list.

## Adding Songs
View the [Songs](#songs) help section for information on adding or changing songs in the song library.

To search for a specific song, use the _Search_ box. Results will appear below. You can chose how results are filtered by clicking the _settings_ (![settings](#settings)) button and changing how song results are filtered.  
To add a song to the presentation, click & drag it from the _Results_ list into the _Presentation_ list. You can also select a result by clicking on it, and then click the _Add_ button at the bottom of the _Song_ tab to add the selected song to the end of the presentation.

## Adding Text
In the _Text_ tab, you can enter text and change it's appearance.  
To add the text to the presentation, click the _Add_ button at the bottom of the _Text_ tab. This will append it to the end of the presentation. If you want to insert it to a specific location within the presentation, click and drag the _Add_ button into the _Presentation_ list.

## Adding Images
In the _Images_ tab, you can choose an image and change it's appearance.  
To add the image to the presentation, click the _Add_ button at the bottom of the _Images_ tab. This will append it to the end of the presentation. If you want to insert it to a specific location within the presentation, click and drag the _Add_ button into the _Presentation_ list.  
To add multiple images at the same time, click the _Add Multiple_ button and select image files. They will all be appended to the end of the presentation.


# Presentation Items & Sections
When you have added [song](#adding-songs), [text](#adding-text), or [image](#adding-images) items to the presentation, the _Presentation_ list will display each item and it's sections.  
An item is a element within the presentation and is either a song, text, or image.
Sections are individual parts within an item, which are displayed.
Song and text items can have multiple sections.  
Items in the presentation are added, moved, removed, and edited as a single element containing all their sections.
Sections can be selected (which will also select the whole item) and displayed.

# Modifying Presentation
Items which have multiple sections can be expanded (![expand](#expand-x)) or minimized (![expand-y](#expand-y)) to hide their sections.

Each item has three buttons:  
_Move_ (![move](#move-y)), which can be used to reorder items within the presentation.  
_Edit_ (![edit](#edit)), which can be used to modify the contents and appearance of items.  
_Remove_ (![remove](#remove)), which removes the item from the presentation.  

Individual sections each have a _Preview_ display, _Display_ (![play](#play)) button, and _Content_ information. Clicking on a section will select it.

# Presenting
To display a section, click the _Display_ (![play](#play)) button next to its _Preview_.  
You can move to the next or previous section with the _Next_ (![next](#play-next)), and _Previous_ (![previous](#play-previous)) buttons in the _Presentation Controls_, or by using keyboard shortcuts (`control.keyboard.playNext` and `control.keyboard.playPrevious` respectively).

The **Displayed** section is shown with a highlighted _Display_ (![play](#play)) button.  
The **Selected** section is shown with a blue highlight.

Sections can be selected by clicking on the _Preview_ or _Content_, and by using the **Select Previous** (`control.keyboard.selectPrevious`) and **Select Next** (`control.keyboard.selectNext`) keyboard shortcuts.  
The selected section can be displayed with the **Display Selected** (`control.keyboard.playSelected`) shortcut.  
Displaying a section will automatically select it.

Sections can automatically advance after a set amount of time. The _Timer_ in the the _Presentation Controls_ will show when this happens.
To stop automatic advancing, set the _Play Mode_ to _Manual_ in the _Presentation Controls_.

If you would like to hide the currently displayed section (without disabling the display), you can click the _Blank_ button in the _Presentation Controls_. This changes the display to black, and can only be done when the display is enabled.

# Program information
**Display Whisper** will automatically check for updates, and notify you when one is available. You can also manually check if there is a new version by selecting _Help_ > _Check For Updates_ from the _Menu_ in the Control window.  
To see what version you are using and other information such as licenses, select _Help_ > _About_ from the _Menu_ in the Control window.  
**Display Whisper** uses **Electron**.
The versions of **Node**, **Electron**, and **Chromium** used are shown in the _About_ window.

## Reporting Issues
You can report issues, or suggest improvements by selecting _Help_ > _Report Issue_ from the _Menu_ in the Control window.  
The _GitHub_ option will send you to the **Display Whisper** repository. You will need to have a GitHub account in order to create an issue.  
The _Email_ option will open your default email program, with the email address for **Display Whisper**.