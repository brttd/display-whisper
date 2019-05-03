# Saving And Opening Presentations
Options to create, open, or save presentations can be selected in _File_ from the _Menu_ in the Control window.

The current presentation is auto-saved, how often this is done can be changed in the Preferences, under _General_ > _Main_ > _Auto-save time_.  
When **Display Whisper** is opened, the last auto-save will be loaded.

>**Note:**  
The auto-save does not modify any presentation files you have saved. The auto-save is so that **Display Whisper** has a backup of the presentation, and will be used even if the presentation is never saved to a file.  
A presentation file will only be modified when you manually save the presentation to it.

# Presentation Controls
The _Presentation Controls_ in the Control window include a timer, buttons for moving through the presentation, and play options
* ![play-first](#play-first) Move to start of presentation
* ![play-last](#play-last) Move to end of presentation
* ![play-previous](#play-previous) Move to previous section
* ![play-next](#play-next) Move to next section
* **Blank** Makes the display black (Can only be used when one or more screen is used for display output)
* **Shuffle** If enabled, when the presentation moves from one item to another, the next item will be chosen randomly. This happens when moving backwards and forwards through the presentation. Going forwards and backwards between sections within an item will behave as normal
* **Loop** If enabled, advancing whilst at the end of the presentation will move to the first section in the presentation. Likewise going backwards when at the start will go to the last section
* **Play Options**
    * ***Auto*** Sections advance either when manually moving through the presentation, or when set to automatically advance
    * ***Manual*** Sections will only advance when manually moving through the presentation. All options for automatic advancing will be ignored

The presentation can also be controlled with keyboard shortcuts:
* `control.keyboard.playNext` Display the next section
* `control.keyboard.playPrevious` Display the previous section
* `control.keyboard.selectNext` Select next section
* `control.keyboard.selectPrevious` Select previous section
* `control.keyboard.selectNextItem` Select next item (and its first section)
* `control.keyboard.selectPreviousItem` Select previous item (and its first section)
* `control.keyboard.playSelected` Display the selected section
* `control.keyboard.toggleBlank` Toggle blank option

When keeping a keyboard shortcut pressed, the action can be repeatedly activated. By default this is disabled, you can change it in the Preferences, under _Shortcuts_ > _General Keyboard Shortcuts_ > _Execute actions repeatedly while shortcut is pressed_.  
The speed at which it is repeated is dependent on the OS keyboard settings.

>**Note:**  
Displaying a section will also select it.

You can also reorder items in the presentation with keyboard shortcuts:
* `control.keyboard.moveSelectedDown` Move the selected item down
* `control.keyboard.moveSelectedUp` Move the selected item up
* `control.keyboard.moveSelectedBottom` Move the selected item to the end
* `control.keyboard.moveSelectedTop` Move the selected item to the start

>**Note:**  
These, and all other keyboard shortcuts can be changed in the Preferences, under _Shortcuts_ > _Control Keyboard Shortcuts_.

# Changing Display Output
The _Display Menu_ in the Control window has buttons for enabling & disabling display output for each available screen.
There are also 5 keyboard shortcuts:
* `control.keyboard.disableDisplay` Turn off display output for all screens
* `control.keyboard.toggleDisplayScreen1` Toggle display output for screen 1.
* `control.keyboard.toggleDisplayScreen2` Toggle display output for screen 2.
* `control.keyboard.toggleDisplayScreen3` Toggle display output for screen 3.
* `control.keyboard.toggleDisplayScreen4` Toggle display output for screen 4.

>**Note:**  
Using a keyboard shortcut for a screen which isn't available will have no effect.

## Display Size And Appearance
Because multiple screens (each with a different size) can simultaneously be used for display output, there is one "master" display size used. All display outputs will scale from the master display size to fit their specific size.
The master display can be set to a specific size, or be set to change based on the screens based for display output.
_Display_ > _Screen
The options for display appearance, under _Display_ > _Screen_ are:
* **Hide cursor on display** When enabled, the cursor will not show when it is over a display output
* **Master display size**
    What is used for the the master display
    * ***Smallest*** The smallest active display output screen will be used
    * ***Average*** The average size of all active display output screens will be used
    * ***Largest*** The largest active display output screen will be used
    * ***Custom*** The custom width and height options will be used
* **Custom master display width** The width of the master display, when set to **Master display size** is set to ***Custom***
* **Custom master display height** The height of the master display, when set to **Master display size** is set to ***Custom***
* **Letterbox displays** Whether or not to show letterboxing/pillarboxing around the display on outputs which are different aspect ratios to the master display
* **Letterbox color** The color of the letterbox/pillarbox. If **Letterbox displays** is disabled, then the background color of the displayed slide will be used instead

>**Note:**
If *Smallest*, *Average*, or *Largest* is selected and no screens have been set as display output, the custom size will be used until a screen is used for display output.  
When a screen has been set as display output, if all screens are again disabled then the most recently enabled screen will be used.  
If **Master display size** is set to ***Smallest*** or ***Largest*** then the screen being used as master display will be shown with square brackets around its number in the _Display Menu_ in the Control window.


# Previews
The _Previews_ in the Control window can each be set to one of four options:
* **Active** shows the currently displayed section
* **Preview** shows the currently selected section
* **Previous** shows the section before the displayed section
* **Next** shows the section after the displayed section
