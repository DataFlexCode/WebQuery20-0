# WebQuery20-0
WebQuery for DataFlex 20.0

Some quick patches so you can at least compile and run it under DataFlex 20.0.
This should make it all work, but won't make it 64 bit compatible (it might work, but more likely it has some issues)

This workspace depends on the Stables library, get it here: https://github.com/DataFlexCode/Stables20
Because DF20 currently has two broken functions (overstrike and pos) you need to overwrite Stables files with the patches in folder Stables-patches.
After that, it should work.
