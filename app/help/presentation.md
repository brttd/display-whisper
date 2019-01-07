# Saving And Opening Presentations
Options to create, open, or save presentations can be selected in _File_ from the _Menu_ in the Control window.  
You can also use keyboard shortcuts:
* `control.keyboard.newPlaylist` Create new presentation.
* `control.keyboard.openPlaylist` Open presentation.
* `control.keyboard.savePlaylist` Save presentation.
* `control.keyboard.savePlaylistAs` Save presentation as.

The current presentation is auto-saved, how often this is done can be changed in the Preferences, under _General_ > _Main_ > _Auto-save time_.  
When **Display Whisper** is opened, the last auto-save will be loaded.

>**Note:**  
The auto-save does not modify any presentation files you have saved. The auto-save is so that **Display Whisper** has a backup of the presentation, and will be used even if the presentation is never saved to a file.  
A presentation file will only be modified when you manually save the presentation to it.

# Presentation Controls
The _Presentation Controls_ in the Control window include a timer, buttons for moving through the presentation, and play options
* ![play-first](#play-first) Move to start of presentation.
* ![play-last](#play-last) Move to end of presentation.
* ![play-previous](#play-previous) Move to previous section.
* ![play-next](#play-next) Move to next section.
* **Blank** Makes the display black (Can only be used when display is enabled).
* **Shuffle** If enabled, when the presentation moves from one item to another, the next item will be chosen randomly. This happens when moving backwards and forwards through the presentation. Going forwards and backwards between sections within an item will behave as normal.
* **Loop** If enabled, advancing whilst at the end of the presentation will move to the first section in the presentation. Likewise going backwards when at the start will go to the last section.
* _Play Options_
    * **Auto** Sections advance either when manually moving through the presentation, or when set to automatically advance.
    * **Manual** Sections will only advance when manually moving through the presentation. All options for automatic advancing will be ignored.

The presentation can also be controlled with keyboard shortcuts:
* `control.keyboard.playNext` Display the next section.
* `control.keyboard.playPrevious` Display the previous section.
* `control.keyboard.selectNext` Select next section.
* `control.keyboard.selectPrevious` Select previous section.
* `control.keyboard.selectNextItem` Select next item (and its first section).
* `control.keyboard.selectPreviousItem` Select previous item (and its first section).
* `control.keyboard.playSelected` Display the selected section.
* `control.keyboard.toggleBlank` Toggle blank option.

When keeping a keyboard shortcut pressed, the action can be repeatedly activated. By default this is disabled, you can change it in the Preferences, under _Shortcuts_ > _General Keyboard Shortcuts_ > _Activate shortcuts repeatedly whilst pressed_.  
The speed at which it is repeated is dependent on the OS keyboard settings.

>**Note:**  
Displaying a section will also select it.

You can also reorder items in the presentation with keyboard shortcuts:
* `control.keyboard.moveSelectedDown` Move the selected item down.
* `control.keyboard.moveSelectedUp` Move the selected item up.
* `control.keyboard.moveSelectedBottom` Move the selected item to the end.
* `control.keyboard.moveSelectedTop` Move the selected item to the start.

>**Note:**  
These, and all other keyboard shortcuts can be changed in the Preferences, under _Shortcuts_ > _General Keyboard Shortcuts_.

# Changing Display
The display can be enabled & disabled with the _Display_ (![display](#display)) button in the _Display Menu_ of the Control window.  
There are also three keyboard shortcuts:
* `control.keyboard.toggleDisplay` Toggle between enabled & disabled.  
* `control.keyboard.openDisplay`) Enable the display.  
* `control.keyboard.closeDisplay` Disable the display.

The _Display Menu_ also includes buttons to switch the display to one of the available screens.  
Keyboard shortcuts can be used for up too three screens:
* `control.keyboard.switchDisplayScreen1` Screen 1.
* `control.keyboard.switchDisplayScreen2` Screen 2.
* `control.keyboard.switchDisplayScreen3` Screen 3.

>**Note:**  
Using a keyboard shortcut for a screen which isn't available will have no effect.

## Display Appearance
There are various preferences which allow you too change how the display is shown, and responds to the screen resolution.  
The _Display_ > _Screen_ preferences are:
* **Hide cursor on display**: When enabled, the cursor will not show when it is over the display.
* **Use set size for display**: When enabled, the display will be the chosen size, regardless of what resolution the screen being used is. The display will be scaled up or down to fit into the chosen screen.
* **Display size**: What size to use for the display. As presentation elements use **px** values for text size, different display sizes will change the size at which text is shown on screen.
* **Background bar color**: If the chosen screen is a different ratio to the custom display size, the display will be scaled to fit. Bars above & below, or to the left & right will be shown, with the given color.

# Previews
The _Previews_ in the Control window can each be set to one of four options:
* **Active** shows the currently displayed section.
* **Preview** shows the currently selected section.
* **Previous** shows the section before the displayed section.
* **Next** shows the section after the displayed section.
