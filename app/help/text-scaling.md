# Max Lines
The _Max lines_ option controls the maximum amount of lines displayed in a single section. If there are more lines present, they will be split evenly into as many parts as are required.

>**Note:**  
Empty lines are counted as lines.  
Multiple empty lines at the start or end of a text section may result in blank sections.

Setting _Max lines_ to 0 will disable section splitting.

# Scale Text & Unify
The **"Scale Text & Unify"** option will find a text size that makes all text in every section visible, and set all sections to use that size. This keeps all sections at the same text size, and makes sure no text is hidden due to it being too large.  
If possible, it will increase the size of text sections to completely fill their size.  
If the **"Increase text size when scaled"** preference is disabled, it will not increase the size to any larger than the currently largest text section.

For songs, this is done independently on the **Intro**, **Outro**, **Section Overlay**, and **End Overlay** elements.

>**Note:**  
Song content sizing is done for all sections, not just the ones currently in use.  
A section not in the play-order with a large amount of text may cause the other sections to have a small text size!

Song and text items will automatically fit & unify when added to the _Presentation_, or opening a file. This can be changed in the Preferences, under _Display_ > _Text Scaling_ > _Scale text & unify..._

# Display Sizing
If a section has too much text or its text size is too large to fit all of it in the text element, the text size will be scaled down to fit all text. This happens automatically to prevent any issues with parts of text not showing, and can be disabled in the Preferences, under _Display_ > _Text Scaling_ > _Always scale text which is too large_.

Any sections in the _Presentation_ with too small text will be highlighted in red. This is too warn you that text may be illegible when displayed. The size at which the warning is shown can be changed in the Preferences, under _Display_ > _Text Scaling_ > _Minimum text size_.