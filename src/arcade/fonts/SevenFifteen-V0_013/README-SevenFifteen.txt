Seven Fifteen is a pixel-style multilingual monospace(ish?) True Type font for use in video games and pixel art. It contains over 25,000 characters, as well as OpenType feature support. Accents are properly placed, Arabic characters join properly, and Devanagari conjuncts work!

Current Version 0.013
Please check https://burpyfresh.itch.io for updates.

LICENSE 

Attribution 4.0 International (CC BY 4.0). You can use this font in both personal and commercial products, and also make modifications as long as you attribute Douglas Vautour (Burpy Fresh). Please let me know if you decide to use this font in your project! I'd love to see it! Please post screenshots in the comments!

*This font will always be free, but I may ask for donations in the future. At that point, if you have found this font useful, please feel free to donate. :) 

RECOMMENDED ATTRIBUTION

"Seven Fifteen Font" by Douglas Vautour (Burpy Fresh) is licensed under CC-BY 4.0.

INSTALLATION

Use as any other TTF file. 

Windows - Double click on the file to open the font viewer. Click on the Install button to Install font. You may need to restart any programs you were using.

Mac - Drag font file into the ~/Fonts folder.

UNITY USAGE NOTES

Working with GPOS/GSUB for Kerning, Mark Placement & Glyph Substitution
The current production version of TextMesh Pro does not have support for GPOS/GSUB tables. Accessing these tables on import requires a 3.2.0-pre.X (not 4.x) preview version. Information about installing a preview version of TextMesh Pro can be found here.

As this is a monospace font, other versions of TextMesh pro will likely be fine for most cases, but custom accented characters may not display correctly. 

Accurately Representing a Pixel Font
In the Font Asset Creator in TextMeshPro, using a Sample Size (Point Size) of 20, padding to 1px, setting Render Mode to RASTER, and turning on "Get Font Features" will give the best results. 

Using the entire font will require a large mesh size (2048 x 2048 or higher), and will take hours to process on "Optimum" settings. 

After creating the Font Asset, tap the arrow on its icon to expand, go to the Atlas , and set the filter mode to "Point". this will stop any rounding that may have been present.

Arabic & Devanagari Support
This font has support for modern Arabic & Devanagari, but Unity and TextMesh Pro currently don't. (Devanagari requires access to non-unicode glyphs in the font, and TextMeshPro doesn't seem to support this.) According to the Unity Forums, there are plugins available for Arabic, but I haven't tested them yet. If I find a working solution I'll post it here.

GODOT USAGE NOTES

Apparently it just works. Figures.