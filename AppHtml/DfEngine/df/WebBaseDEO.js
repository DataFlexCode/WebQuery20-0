/*
Class:
    df.WebBaseDEO
Extends:
    df.WebBaseControl

This class is the client-side representation of the WebBaseDEO class that has most of the Data Entry 
Object logic.
    
Revision:
    2011/07/16  (HW, DAW) 
        Initial version.
*/
df.WebBaseDEO = function WebBaseDEO(sName, oParent){
    df.WebBaseDEO.base.constructor.call(this, sName, oParent);
    
    this.prop(df.tString, "psValue", "");
    this.prop(df.tBool, "pbChanged", false);
    
    this.prop(df.tInt, "peDataType", df.ciTypeText);
    this.prop(df.tInt, "piPrecision", 0);
    this.prop(df.tInt, "piMaxLength", 0);
    this.prop(df.tBool, "pbCapslock", false);
    this.prop(df.tBool, "pbRequired", false);
    this.prop(df.tBool, "pbReadOnly", false);
    
    this.prop(df.tInt, "peAlign", -1);
    this.prop(df.tString, "psMask", "");
    
    //  Events
    this.event("OnAutoFind");
    this.event("OnChange");

    //@privates
    this._tValue = null;
    this._sOrigValue = "";
    
    this._bFilters = true;
    this._bMasks = true;
    this._bAutoFind = false;
    this._bReplaceDecSepp = false;  // Used by filterNumeric (keypress) that the decimal separator needs to be corrected by enhanceNumeric (keyup)
    
    this._aMaskChars = null;
    
    this._oErrorBalloon = null;
    this._aErrors = [];         //  Array of errors shown in the format { iNumber : df.tInt, sText : df.tString }
    
    // this.setActionMode("Request_Save", df.cCallModeWait);
    // this.setActionMode("Request_Delete", df.cCallModeWait);
    
    //  Always mark psValue & pbChanged as synchronized properties
    this.addSync("psValue");
    this.addSync("pbChanged");
};
/*
This class adds most Data Entry Object logic to the inheritance tree. It contains a lot of the 
validation functionality and has support for masking & input filtering.
*/
df.defineClass("df.WebBaseDEO", "df.WebBaseControl",{

/*
This method is called after the control is rendered and provides an opportunity to further 
initialize the DOM elements.

@private
*/
afterRender : function(){
    df.WebBaseDEO.base.afterRender.call(this);
    
    //  Set property value to apply them to to the DOM
    var sVal = this.psValue;
    this.set_peDataType(this.peDataType);
    this.set_psValue(sVal);
    this.set_pbCapslock(this.pbCapslock);
    this.set_peAlign(this.peAlign);
    
    this.set_pbEnabled(this.pbEnabled); //  WebBaseUIObject doesn't call it any more
    
    df.dom.enableTextSelection(this._eControlWrp);
    
    //  Attach listener
    if(this._eControl){
        df.events.addDomListener("change", this._eControl, this.onChange, this);
        df.events.addDomKeyListener(this._eControl, this.onKey, this);
        
        df.dom.enableTextSelection(this._eControl);
    }
},

/*
This method is called to attach the focus event handlers. These can be attached differently for the 
different controls. For data entry objects they are attached pretty straight forward to the control 
element.

@private
*/
attachFocusEvents : function(){
    //  We use a simpler focus detection on the control
    if(this._eControl){
        df.events.addDomListener("focus", this._eControl, this.onFocus, this);
        df.events.addDomListener("blur", this._eControl, this.onBlur, this);
    }
},

// - - - - - - Server API - - - - - -

/*
This getter determines the changed state. It will first look at the pbChanged property (which can be 
set to true by user interface events). If pbChanged was false it will also compare the original 
value with current value.
*/
get_pbChanged : function(){
    if(!this.pbChanged && this._eElem){
		this.updateTypeVal();
    }

    return this.pbChanged || this._sOrigValue !== this.getServerVal();
},

/*
This setter updates the current value of the component. It will first update the internal typed 
values and then update the displayed value according to the proper masking rules.

@param  sVal    The new value.
*/
set_psValue : function(sVal){
    // this._sOrigValue = sVal;

    //  Set the type specific value
    this._tValue = this.serverToType(sVal);
    this.psValue = sVal;
    
    // this.tValue = toTypeVal(sVal);
    this._sPrevChangeVal = this._sOrigValue = this.getServerVal();
    
    //  Update the displayed value
    this.refreshDisplay(this._tValue);
    
    //  If a new value is set we assume that errors don't apply any more
    this.hideAllControlErrors();
},

/*
This getter returns the current value in the 'server format'. First it updates the current value 
according to the current value inside the control then it gets it in the 'server format' using the 
getServerVal method.
*/
get_psValue : function(){
    //  Update the type specific value from the DOM
    if(this._eElem){
        this.updateTypeVal();
    }

    //  Return the 'server' value
    return this.getServerVal();
},

/*
This setter changes the data type. It will attach the event handlers for the input filters and apply 
the CSS class for the markup of the type.

@param  iVal    The new value.
*/
set_peDataType : function(iVal, bSvr){
    var sValue;
    
    if(this._eControl){
        //  Add event listeners for input filters
        if(this._bFilters){
            df.events.removeDomListener("keypress", this._eControl, this.filterDate);
            df.events.removeDomListener("keypress", this._eControl, this.filterNumeric);
            df.events.removeDomListener("keyup", this._eControl, this.enhanceNumeric);
            
            if(iVal === df.ciTypeBCD){
                df.events.addDomListener("keypress", this._eControl, this.filterNumeric, this);
                df.events.addDomListener("keyup", this._eControl, this.enhanceNumeric, this);
            }else if(iVal === df.ciTypeDate || iVal === df.ciTypeDateTime){
                df.events.addDomListener("keypress", this._eControl, this.filterDate, this);
            }
        }
        
        //  Preserve value & changed-state
        if(bSvr){
            sValue = this.get_psValue();
        }
        // this.pbChanged = this.get_pbChanged();
        
        //  Make sure the new data type is properly applied
        this.peDataType = iVal;
        this.initMask();
        
        //  Update the displayed value with the new data type
        if(bSvr){
            this.set_psValue(sValue);
        }
        
        //  Set CSS class based on data type
        df.dom.removeClass(this._eControl, "dfData_BCD dfData_Date dfDate_Text");
        if(iVal === df.ciTypeBCD){
            df.dom.addClass(this._eControl, "dfData_BCD");
        }else if(iVal === df.ciTypeDate){
            df.dom.addClass(this._eControl, "dfData_Date");
        }else{
            df.dom.addClass(this._eControl, "dfData_Text");
        }
    }

},

/*
This setter updates the used mask. It makes sure that the new mask is properly initialized and tries 
to keep the value correct by calling updateTypeVal and refreshDisplay before and after the change.

@param  sVal    The new mask.
*/
set_psMask : function(sVal){
    //  Make sure the current value is correct using the 'old mask'
    this.updateTypeVal();
    this.psMask = sVal;
    this.initMask();
    
    //  Update the displayed value with the new mask
    this.refreshDisplay(this._tValue);
},

set_pbCapslock : function(bVal){
    if(this._eControl){
        this._eControl.style.textTransform = (bVal ? "uppercase" : "");
    }
},

set_pbEnabled : function(bVal){
    df.WebBaseDEO.base.set_pbEnabled.call(this, bVal);
    
    if(this._eControl){
        this._eControl.disabled = !bVal;
        this._eControl.tabIndex = (bVal ? 0 : -1);
    }
},

set_peAlign : function(iVal){
    if(this._eControl){
        this._eControl.style.textAlign = (iVal === df.ciAlignLeft ? "left" : (iVal === df.ciAlignCenter ? "center" : (iVal === df.ciAlignRight ? "right" : "")));
    }
},

// - - - - - - Data type logic - - - - - -

/*
This method updates the displayed value. It does this based on the type specific value and uses 
typeToDisplay to markup the value.

@param  tVal    The new value in the type specific format.
@private
*/
refreshDisplay : function(tVal){
    var sVal;

    if(this._eElem){
        sVal = this.typeToDisplay(tVal);
        this.setControlValue(sVal);
    }
},

/*
This method determines the type specific value with a new value which is usually received from the 
server. The value is supplied in the 'server format' and is parsed into the private type specific 
value.

@param  sVal    The new value provided in the 'server format'.
@return The type specific value (date object or number).
@private
*/
serverToType : function(sVal){
    var tVal = sVal;
    
    if(this.peDataType === df.ciTypeBCD){
        tVal = df.sys.data.stringToNum(sVal, "."); 
    }else if(this.peDataType === df.ciTypeDate){
        tVal = df.sys.data.stringToDate(sVal, "yyyy/mm/dd", "-"); // TODO: Shoud be yyyy-mm-dd
    }else if(this.peDataType === df.ciTypeDateTime){
        tVal = df.sys.data.stringToDate(sVal, "yyyy/mm/ddThh:mm:ss.fff");
    }
    
    return tVal;
},

/*
This method converts a type specific value to a display value.

@param  tVal    Value in type specific format (number or date object).
@return String with the display value.
*/
typeToDisplay : function(tVal){
    var sVal = tVal;

    if(!this._bHasFocus && this.psMask && this.peDataType !== df.ciTypeText){    //  If the field doesn't have the focus we need to apply a mask
        if(this.peDataType === df.ciTypeDate || this.peDataType === df.ciTypeDateTime){ // Date mask
            sVal = (tVal && df.sys.data.applyDateMask(tVal, this.psMask, this.dateSep(), this.timeSep())) || "";
        }else if(this.peDataType === df.ciTypeBCD){ // Numeric mask
            sVal = (tVal !== null && df.sys.data.applyNumMask(tVal || 0.0, this.psMask, this.decSep(), this.thousSep(), this.getWebApp().psCurrencySymbol)) || "";
        }
    }else if(this.psMask && this.peDataType === df.ciTypeText){  //  Window mask
            sVal = df.sys.data.applyWinMask(sVal, this.psMask);
    }else{  //  No mask
        if(tVal !== ""){    // Leave blank value alone
            if(this.peDataType === df.ciTypeBCD){   //  Plain number
                sVal = (tVal !== null && df.sys.data.numToString(tVal, this.decSep(), this.piPrecision));
            }else if(this.peDataType === df.ciTypeDate){   //  Plain date
                sVal = (tVal && df.sys.data.dateToString(tVal, this.dateFormat(), this.dateSep(), this.timeSep())) || "";
            }else if(this.peDataType === df.ciTypeDateTime){   //  Plain date time
                sVal = (tVal && df.sys.data.dateToString(tVal, this.dateTimeFormat(), this.dateSep(), this.timeSep())) || "";
            }
        }
    }
    
    return sVal;
},

dateFormat : function(){
    return this.getWebApp().psDateFormat;
},

dateTimeFormat : function(){
    return this.getWebApp().psDateTimeFormat;
},

dateSep : function(){
    return this.getWebApp().psDateSeparator;
},

decSep : function(){
    return this.getWebApp().psDecimalSeparator;
},

thousSep : function(){
    return this.getWebApp().psThousandsSeparator;
},

timeSep : function(){
    return this.getWebApp().psTimeSeparator;
},

/*
This method updates the value properties from the user interface. It uses the getControlValue method 
to get the value from the user interface (usually the DOM). If a numeric or date mask is applied 
then it doesn't update since those are not changed. The type specific properties (_nValue and 
_dValue) are also updated.

@private
*/
updateTypeVal : function(){
    var sVal = this.getControlValue();
    
    if(this.pbCapslock){
        sVal = sVal.toUpperCase();
    }
    
    if(this.peDataType === df.ciTypeText && this.psMask){    //  Window mask is always read from the DOM
        //  Read the value and remove the mask characters
        this.psValue = this._tValue = this.clearWinMask(sVal);
    }else if(this._bHasFocus || !this.psMask){      //  The value is not updated when masked value is shown (exept window mask)
        this.psValue = sVal;
        
        //  Parse to the typed value if needed.
        if(this.peDataType === df.ciTypeBCD){
            this._tValue = df.sys.data.stringToNum(sVal, this.decSep(), this.thousSep());
        }else if(this.peDataType === df.ciTypeDate){
            this._tValue = df.sys.data.stringToDate(sVal, this.dateFormat(), this.dateSep());
        }else if(this.peDataType === df.ciTypeDateTime){
            this._tValue = df.sys.data.stringToDate(sVal, this.dateTimeFormat(), this.dateSep(), this.timeSep());
        }else{
            this._tValue = sVal;
        }
    }
},

/*
This method returns the current format as a string in the server format. It uses the type specific 
properties (_nValue and _dValue) or psValue as the current value.

@return The current value in server format.
@private
*/
getServerVal : function(){
    if(this._tValue !== null){
        if(this.peDataType === df.ciTypeBCD){
            return this._tValue.toString(); //df.sys.data.numToString(this._tValue, ".", this.piPrecision);
        }
        if(this.peDataType === df.ciTypeDate){
            return (this._tValue instanceof Date && df.sys.data.dateToString(this._tValue, "yyyy/mm/dd", "-")) || "";
        }
        if(this.peDataType === df.ciTypeDateTime){
            return (this._tValue instanceof Date && df.sys.data.dateToString(this._tValue, "yyyy/mm/ddThh:mm:ss.fff", "-", ":")) || "";
        }
    }
    
    return this.psValue;
},

/*
This method reads the current value from the user interface. It will be overridden by the different 
type of Data Entry Objects. The default implementation reads the value property of the control DOM 
element.

@return The currently displayed value.
@private
*/
getControlValue : function(){
    if(this._eControl){
        return this._eControl.value;
    }
    
    return this.psValue;
},

/*
This method sets a value to the user interface. It will be overridden by the different type of Data 
Entry Objects. The default implementation sets the value property of the control DOM element.

@param  sVal    The new value to display.
*/
setControlValue : function(sVal){
    if(this._eControl && this._eControl.value !== sVal){
        this._eControl.value = sVal;
    }
},


// - - - - - - Window masks - - - - - - 

/*
This method initializes the window mask system. It will attach the listeners (after removing them 
first so a clean situation exists after changing from a window mask to another mask). The mask 
characters are analyzed and an array of describing objects is created. That array is used for quick 
access by the filterWinMask and correctWinMask method.

@private
*/
initMask : function(){
    var i, sChar, sMask = this.psMask;
    
    if(this._bMasks){
        
        //  Clean up
        this._aMaskChars = null;
        if(this._bFilters){
            df.events.removeDomListener("keypress", this._eControl, this.filterWinMask, this);
            
            df.events.removeDomListener("keyup", this._eControl, this.correctWinMask, this);
            df.events.removeDomListener("blur", this._eControl, this.correctWinMask, this);
            df.events.removeDomListener("cut", this._eControl, this.onCutPasteWinMask, this);
            df.events.removeDomListener("paste", this._eControl, this.onCutPasteWinMask, this);
        }
        
        
        if(this.peDataType === df.ciTypeText && this.psMask){

            this._aMaskChars = [];
                    
            //  Fill character information array for quick access (also take in account the "\" exception) which is used only by the filterWinMask
            for(i = 0; i < sMask.length; i++){
                sChar = sMask.charAt(i);
                
                if(sChar === "\\" && i + 1 < this.sMask.length && (sMask.charAt(i + 1) === "#" || sMask.charAt(i + 1) === "@" || sMask.charAt(i + 1) === "!" || sMask.charAt(i + 1) === "*")){
                    i++;
                    this._aMaskChars.push({ bEnter : false, bNumeric : false, bAlpha : false, bPunct : false, sChar : sMask.charAt(i + 1) });
                }else{
                    this._aMaskChars.push({
                        bEnter : (sChar === "#" || sChar === "@" || sChar === "!" || sChar === "*"),
                        bNumeric : (sChar === "#" || sChar === "*"),
                        bAlpha : (sChar === "@" || sChar === "*"),
                        bPunct : (sChar === "!" || sChar === "*"),
                        sChar : sChar 
                    });
                }
            }
            
            //  Attach listeners
            if(this._bFilters){
                df.events.addDomListener("keypress", this._eControl, this.filterWinMask, this);
                
                df.events.addDomListener("keyup", this._eControl, this.correctWinMask, this);
                df.events.addDomListener("cut", this._eControl, this.onCutPasteWinMask, this);
                df.events.addDomListener("paste", this._eControl, this.onCutPasteWinMask, this);
            }
        }
    }
  
    
},

/*
Clears the windows mask from the value by removing the mask characters. If the
value doesn't match the mask the value might be returned incomplete.

@param  sValue  Value to apply the mask on.
@return Clean value to store in the database.

@private
*/
clearWinMask : function(sVal){
    var i = 0, sResult = "";
    
    while(i < sVal.length && i < this._aMaskChars.length){
        if(this._aMaskChars[i].bEnter || sVal.charAt(i) !== this._aMaskChars[i].sChar){
            sResult += sVal.charAt(i);
        }
        
        i++;
    }
    
    return sResult;
},

/*
Corrects the value according to the mask. It tries to preserve the caret 
position and only updates if the value needs to.

@param  oEvent   (optional) Event object.
@private
*/
correctWinMask : function(oEvent){
    var iPos, sNewValue;
    
    //  Calculate the correct value
    sNewValue = df.sys.data.applyWinMask(this.clearWinMask(this._eControl.value), this.psMask);
    
    //  If the correct value is different than the current value update the value (and try to preserve the caret position)
    if(sNewValue !== this._eControl.value){
        iPos = df.dom.getCaretPosition(this._eControl);
        this._eControl.value = sNewValue;
        df.dom.setCaretPosition(this._eControl, iPos);
    }
},

/*
Handles the onpaste and oncut events. It calls the correctWinMask method with 
a slight delay so the value is actually modified.

TODO: It is possible to perform the copy / paste action by ourself and so get 
rid of the delay.

@param  oEvent   Event object.
@private
*/
onCutPasteWinMask : function(oEvent){
    var that = this;
    
    setTimeout(function(){
        that.correctWinMask();
    }, 50);
},


// - - - - - - Input filters - - - - - -

/*
Adds/skips mask characters if the caret is located before them. It cancels 
characters that are not allowed at that position.

@param  oEvent   Event object.
@private
*/
filterWinMask : function(oEvent){
    var iPos, iNewPos, sChar, sValue, oSel;
    
    if(!oEvent.isSpecialKey()){
        sValue = this._eControl.value;
        oSel = df.dom.getSelection(this._eControl);
        iPos = oSel.start;
        sChar = String.fromCharCode(oEvent.getCharCode());
        
        //  Emulate how the value will look when the selection is replaced
        if(oSel.length > 0){
            sValue = sValue.substr(0, oSel.start) + sValue.substr(oSel.end);
        }
        
        //  Skip no enter characters (add them if they aren't already there)
        iNewPos = iPos;
        while(iNewPos < this._aMaskChars.length && !this._aMaskChars[iNewPos].bEnter){
            if(sValue.length <= iNewPos){
                this._eControl.value = sValue + this._aMaskChars[iNewPos].sChar;
            }
            iNewPos++;
        }
        
        //  Set the new caret position if it is moved
        if(iPos !== iNewPos && iNewPos < this._aMaskChars.length){
            df.dom.setCaretPosition(this._eControl, iNewPos);
            iPos = iNewPos;
        }
        
        //  Check if character allowed by mask
        if(iPos >= this._aMaskChars.length || !df.sys.data.acceptWinMaskChar(sChar, this._aMaskChars[iPos].sChar)){
            oEvent.stop();
        }
    }
},

/*
Handles the keypress event for date fields and filters unwanted characters.

@param  oEvent   Event object.
@private
*/
filterDate : function(oEvent){
    var sValue, sFormat, sDateSepp, sTimeSepp, sChar, oSel, iChar, iCarret, bNum, aFormat, aValues, sV, iStartPos, iEndPos, i, iMax, bNext, bChangeVal, bMoveCarret, iNext, bAllow;
    
    //  Determines the maximum amount of numbers for a value block
    function getMax(i){
        switch(aFormat[i]){
            case "f":                
            case "fff":
                return 3;
            case "yyyy":
                return 4;
        }
        return 2;
    }
    
    //  Determines if a block is a value block or a separator block
    function isVal(i){
        return !!aFormat[i].match(/^([mdyhsf]+)$/i);
    }
    
    //  Inserts the next separator block into the value on the carret position
    function insertNext(i){
        //  Regenerate the value
        sValue = sValue.substr(0, iCarret) + aFormat[i].replace("/", sDateSepp).replace(":", sTimeSepp) + sValue.substr(iCarret);
        bChangeVal = true;
        
        //  Move the carret
        iCarret = iCarret + aFormat[i].length;
        bMoveCarret = true;
    }
    
    //  Determines if a character is valid for a separator block
    function isValid(i, iPos){
        var sF = aFormat[i].charAt(iPos);
        
        return (sF === sChar || (sF === "/" && sChar === sDateSepp) || (sF === ":" && sChar === sTimeSepp));
    }
    
    //  Ignore special keys
    iChar = oEvent.getCharCode();
    if(!oEvent.isSpecialKey() && iChar > 0){
    
        //  Gather initial data
        if(this.peDataType === df.ciTypeDateTime){
            sFormat = this.dateTimeFormat();
        }else{
            sFormat = this.dateFormat();
        }
        sDateSepp = this.dateSep();
        sTimeSepp = this.timeSep();
        
        //  Gather details
        sChar = String.fromCharCode(iChar);
        oSel = df.dom.getSelection(this._eControl);
        iCarret = oSel.start;
        sValue = this._eControl.value;
        bNum = (("0123456789").indexOf(sChar) !== -1);
        
        //  Emulate how the value will look when the selection is replaced
        if(oSel.length > 0){
            sValue = sValue.substr(0, oSel.start) + sValue.substr(oSel.end);
        }
    
        // Split format and value into blocks
        aFormat = sFormat.match(/([^mdyhsf]+)|([mdyhsf]+)/gi) || [];
        aValues = sValue.match(/([^0-9\/\:\.]+)|([0-9]+)|([\/\:\.])/gi) || [];
        
        
        
        //  Loop through parts (the value parts while keeping track of the format parts)
        i = 0; 
        iStartPos = 0;
        bAllow = false;
        bMoveCarret = false;
        bChangeVal = false;
        while(i < aValues.length + 1 && i < aFormat.length){
            sV = aValues[i] || "";
            iEndPos = iStartPos + sV.length;
            
            //  Determine if this is the part where the carret is
            if(iCarret >= iStartPos && iCarret <= iEndPos){
                bNext = false;
                
                
                if(bNum){
                    if(isVal(i)){
                        //  Inserting a number into a value is allowed unless the maximum amount of number is reached
                        iMax = getMax(i);
                        if(sV.length >= iMax){
                            //  See if we can jump to the next value block by inserting a separator block (only if the cursor is at the end of the value)
                            if(aValues.length <= i + 1 && iCarret === iEndPos){
                                iNext = i + 1;
                                while(iNext < aFormat.length && !isVal(iNext)){
                                    insertNext(iNext);
                                    iNext++;
                                }
                                bAllow = iNext < aFormat.length && isVal(iNext);
                            }else{
                                bNext = (aFormat.length > i + 1);
                            }
                        }else{
                            bAllow = true;
                        }
                    }else{
                        //  Inserting a number into a separator block
                        
                        if(sV.length === aFormat[i].length && iCarret === iEndPos){
                            //  Move to the next block if this block is complete and we are the end
                            bNext = (aFormat.length > i + 1);
                        }else{
                            //  Complete the block and move the caret to the end
                            sValue = sValue.substr(0, iStartPos) + sValue.substr(iEndPos);
                            bMoveCarret = iCarret !== iStartPos || bMoveCarret;
                            iCarret = iStartPos;
                            bChangeVal = true;
                            insertNext(i);
                            bNext = (aFormat.length > i + 1);
                        }
                    }
                }else{
                    if(isVal(i)){
                        //  Inserting a character into a value is not allowed. If we are at the end of the value we move to the next (separator) block if the value is a valid value
                        if(sV.length > 0 && iCarret === iEndPos){
                            bNext = (aFormat.length > i + 1);
                        }
                    }else{
                        if(sV.length === aFormat[i].length && iCarret === iEndPos){
                            //  This part is complete and the cursor is at the end, move to the enxt
                            bNext = (aFormat.length > i + 1);
                        }else{
                            //  Check if character is allowed and isn't already there. If it is already there we move the cursor till after the character
                            if(isValid(i, iCarret - iStartPos)){
                                if(sValue.charAt(iCarret) !== sChar){
                                    bAllow = true;
                                }else{
                                    iCarret++;
                                    bMoveCarret = true;
                                    bAllow = false;
                                }
                            }
                                            
                        }
                    }
                }  
                
                if(!bNext){
                    break;
                }
            }
            
            iStartPos += sV.length;
            i++;
        }
        
        if(bChangeVal){
            this._eControl.value = sValue;
        }
        
        if(bMoveCarret){
            df.dom.setCaretPosition(this._eControl, iCarret);
        }
        
        if(!bAllow){
            oEvent.stop();
        }
        
    }
},

/*
Filters non numeric characters and prevents the user from entering incorrect 
values.

Params:
    e   Event object
@private
*/
filterNumeric : function(oEvent){
    var iChar, sValidChars, sChar, iSeparator, iBefore, iDecimals, iMaxBefore, iPos, sValue, oSel, sDecSepp, sDecSepparators;
    
    sDecSepp = this.decSep();
    sDecSepparators = sDecSepp + ".,"; //   Make sure that , and . are always accepted as decimal character
    iChar = oEvent.getCharCode();
    
    if(!oEvent.isSpecialKey() && iChar > 0){
        sChar = String.fromCharCode(iChar);
        iPos = df.dom.getCaretPosition(this._eControl);
        oSel = df.dom.getSelection(this._eControl);
        sValue = this._eControl.value;
        sValidChars = "0123456789";
        
        //  Emulate how the value will look when the selection is replaced
        if(oSel.length > 0){
            sValue = sValue.substr(0, oSel.start) + sValue.substr(oSel.end);
        }
        
        
        if(sChar === "-"){
            
            if(!(oSel.length >= 1 && oSel.start === 0)){ //  Allow entering "-" when it is selected
                if(iPos === 0){   //  Only allow "-" at the first position
                    //  When at the first position but a caret is already there we allow the user
                    if(sValue.indexOf("-") !== -1){
                        df.dom.setCaretPosition(this._eControl, 1);
                        oEvent.stop();
                    }
                }else{
                    oEvent.stop();
                }
            }
        }else if(sDecSepparators.indexOf(sChar) >= 0){
            iSeparator = sValue.indexOf(sDecSepp);
            
            if(iPos === iSeparator && oSel.length === 0){ // If we are at the decimal separator typing a decimal separator we move the caret one position
                df.dom.setCaretPosition(this._eControl, iPos + 1);
                oEvent.stop();
            }else if(iSeparator !== -1 && (iSeparator < iPos || iSeparator > (iPos + oSel.length))){ //    If there is a separator it must be selected
                oEvent.stop();
            }else if(sValue.indexOf("-") >= iPos && sValue.indexOf("-") >= iPos + oSel.length){ //  Make sure we don't insert before the "-"
                oEvent.stop();
            }else if(sValue.length - oSel.length - iPos > this.piPrecision){   //  Make sure we don't get to may decimals
                oEvent.stop();
            }else if(this.piPrecision <= 0){ // Are decimals actually allowed?
                oEvent.stop();
            }else{
                //  Make sure that incorrect decimal separators will be replaced by the enhanceNumeric
                this._bReplaceDecSepp = sChar !== sDecSepp;
            }
            
            
        }else if(sValidChars.indexOf(sChar) !== -1){
            //  When we are before the the "-" we move one character forward
            if(iPos === 0 && sValue.indexOf("-") !== -1 && oSel.length === 0){
                iPos++;
                df.dom.setCaretPosition(this._eControl, iPos);
            }
            
            iMaxBefore = this.piMaxLength - this.piPrecision;
            
            if(iMaxBefore >= 0 && this.piPrecision >= 0){
                //  Determine separator, numbers before and decimals
                iSeparator = sValue.indexOf(sDecSepp);
                iBefore = (iSeparator === -1 ? sValue.length : iSeparator) - (sValue.indexOf("-") === -1 ? 0 : 1);
                iDecimals = (iSeparator === -1 ? 0 : sValue.length - iSeparator - 1);
                
                
                if(iPos <= iSeparator || iSeparator === -1){
                    //  Don't allow to many numbers before (add / move to after decimal separator if we are there and there is room after)
                    if(iBefore >= iMaxBefore){
                        if(iDecimals < this.piPrecision && iSeparator !== -1 && iPos === iSeparator){
                            iPos++;
                            df.dom.setCaretPosition(this._eControl, iPos);
                        }else if(iDecimals < this.piPrecision && iSeparator === -1 && iPos === sValue.length){
                            this._eControl.value = sValue + sDecSepp;
                        }else{
                            oEvent.stop();
                        }
                    }
                }else if(iDecimals >= this.piPrecision){ //  Don't allow to may decimals!
                    oEvent.stop();
                }
            }
        }else{
            oEvent.stop();
        }
    }
},

/*
The enhanceNumeric event handler is attached to the keyup event and manipulates the value when 
needed after it has been changed by the keypress event. It will correct the decimal separator if a 
incorrect separator is used which is supported to make the . on the numeric keyboard work for 
different decimal separator.

@param  oEvent  Event object (df.events.DOMEvent)
@private
*/
enhanceNumeric : function(oEvent){
    if(this._bReplaceDecSepp){
        this._eControl.value = this._eControl.value.replace(/[\.,]/g, this.decSep());
        
        this._bReplaceDecSepp = false;
    }
},

/*
This method performs the validations that are needed. It performs some client-side validations and \
will trigger the server-side validation by firing the OnValidate event.

@return True if no validation errors occurred. Note that server-side validatione errors are 
            triggered later.
*/
validate : function(){
    var bResult = true, sVal;
    
    if(this.pbRequired){
        sVal = this.get_psValue();
        
        if((this.peDataType === df.ciTypeBCD && parseFloat(sVal) === 0.0) || sVal === ""){
            bResult = false;
            this.showControlError(13, this.getWebApp().getTrans("err_entry_required"));
        }else{
            this.hideControlError(13);
        }
    }
    
    if(bResult){
        //  Make sure that OnChange is fired before OnValidate
        this.fireChange();
        this.fireAutoFind();
    
        this.fire("OnValidate", [], function(oEvent){
            if(oEvent.bServer){
                //  If handled on the server this means ASynchronous so we have to put the focus back manually if a problem occurred
                if(oEvent.sReturnValue === "0"){
                    if(this.selectAndFocus){
                        this.selectAndFocus();
                    }else{
                        this.focus();
                    }
                }else{
                    this.hideAllControlErrors();
                }
            }else{
                //  If handled on the client we can make bResult false if event stopped to cancel moving out of the field
                if(oEvent.bCancelled){
                    bResult = false;
                }
            }
        });
    }
    
    return bResult;
},  


// - - - - - - Event handling - - - - - -

/*
This method handles the onKey event and performs the various actions like finds, saves & deletes. It 
also initiates the validations when tabbing out of the field.

@param oEvent   The event object.
*/
onKey : function(oEvent){
    var oView = this.getView();

    if(oEvent.matchKey(df.settings.formKeys.tabOut)){ 
        if(!this.validate()){
            oEvent.stop();
        }
    }
},

/*
Augments the onFocus event listener and calls the refreshDisplay method after forwarding the onFocus 
event. This will make sure that the value will be displayed in the proper edit format.

@param  oEvent   Event object.
@private
*/
onFocus : function(oEvent){
    df.WebBaseDEO.base.onFocus.call(this, oEvent);
    
    this.refreshDisplay(this._tValue);
},

/*

@param  oEvent   Event object.
@private
*/
onBlur : function(oEvent){
    this.updateTypeVal();
    
    this.fireAutoFind();
    
    df.WebBaseDEO.base.onBlur.call(this, oEvent);
    
    this.refreshDisplay(this._tValue);
},

/*
This method checks if the value is changed and if so it will trigger the OnChange event.
*/
fireChange : function(){
    var sNewVal;
    
    //  Check the new value
    this.updateTypeVal();
    sNewVal = this.getServerVal();
    
    //  Only fire events if it changed
    if(this._sPrevChangeVal !== sNewVal){
        this.pbChanged = true;
        
        //  Fire events (OnSelectedChange on every radio and OnSelect on the selected one)
        this.fire('OnChange', [ sNewVal , this._sPrevChangeVal]);
        
        this._bAutoFind = true;
        
        //  Remember the value
        this._sPrevChangeVal = sNewVal;
    }
},

/*
This method fires the autofind event when needed. The fireChanged method updates a Boolean when the 
value is changed telling us that we need to do an autofind. We reset the Boolean so that we don't do 
an autofind too often. The autofind is called from the blur event and the validation method because 
it should fire on the blur but before OnValidate.
*/
fireAutoFind : function(){
    if(this._bAutoFind){
        //  Fire autofind event
        this.fire('OnAutoFind');
        
        this._bAutoFind = false;
    }
},

/*
Augments the onBlur event and calls the updateTypeVal to update the value properties before 
forwarding the onBlur. The refreshDisplay method is called after the onBlur to display the properly 
masked value.

@param  oEvent   Event object.
@private
*/
onChange : function(){
    this.fireChange();
},

// - - - - - - Error handling - - - - - -

/* 
Displays an error in a info balloon next to the control. As multiple errors can be active at the 
same time an array of errors is maintained and updated. Will also apply the WebError class to the 
control.

@param  iErrNum     Error ID.
@param  sErrText    Error description / text.
@client-action
*/
showControlError : function(iErrNum, sErrText){
    var i;
    
    iErrNum = parseInt(iErrNum, 10);
    
    for(i = 0; i < this._aErrors.length; i++){
        if(this._aErrors[i].iNumber === iErrNum){
            this._aErrors[i].sText = sErrText;
            this.updateErrorDisp();
            return;
        }
    }
    
    this._aErrors.push({
        iNumber : iErrNum,
        sText : sErrText
    });
    
    this.updateErrorDisp();
},

/* 
Hides a specific error displayed using showControlError. Removes the error from the administration 
and updates the display.

@param  iErrNum   Error ID.
@client-action
*/
hideControlError : function(iErrNum){
    var i;
    
    for(i = 0; i < this._aErrors.length; i++){
        if(this._aErrors[i].iNumber === iErrNum){
            this._aErrors.splice(i, 1);
            
            this.updateErrorDisp();
            break;
        }
    }
},

/* 
Hides all errors by clearing the administration and hiding the error balloon.

@client-action
*/
hideAllControlErrors : function(){
    this._aErrors = [];
    this.updateErrorDisp();
},

/* 
Updates the error display according to the _aErrors administration. Will show / hide the info 
balloon and add / remove the "WebError" CSS class.

@private
*/
updateErrorDisp : function(){
    var i, aHtml = [];
    
    if(this._aErrors.length > 0){
        //  Generate errors html
        for(i = 0; i < this._aErrors.length; i++){
            if(i > 0){
                aHtml.push('<br>');
            }
            aHtml.push(this._aErrors[i].sText);
        }
        
        //  Create tooltip if needed
        if(!this._oErrorBalloon){
            this._oErrorBalloon = new df.InfoBalloon(this, "WebErrorTooltip", aHtml.join(''));
            this._oErrorBalloon.update();
        }else{
            //  Update & show tooltip
            this._oErrorBalloon.psMessage = aHtml.join('');
        }
        this._oErrorBalloon.show();
        
        
        df.dom.addClass(this.getErrorElem(), "WebError");
        
        this.makeVisible();
        
        this.focus();
    }else{
        //  Hide tooltip if needed
        if(this._oErrorBalloon){
            this._oErrorBalloon.hide();
            
            df.dom.removeClass(this.getErrorElem(), "WebError");
        }
    }
},

/* 
Used by the showControlError logic to determine on which element the "WebError" class needs to be 
applied. Can be overridden by sub-classes.

@private
*/
getErrorElem : function(){
    return this._eElem;
},

/* 
Augment the resize method to make sure that the error balloon is resized / repositioned when needed.

@private
*/
resize : function(){
    df.WebBaseDEO.base.resize.call(this);

    if(this._oErrorBalloon){
        this._oErrorBalloon.resize();
    }
},


/* 
Makes sure that the control is visible by going up in the object structure looking for controls 
that can hide the current control (like WebCards / WebTabPages).

@private
*/
makeVisible : function(){
    var oControl = this;
    
    while(oControl){
        if(oControl instanceof df.WebCard){
            oControl.show();
        }
        
        oControl = oControl._oParent;
    }
}

});