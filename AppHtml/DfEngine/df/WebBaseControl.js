/* 
Class:
    df.WebBaseControl
Extends:
    df.WebBaseUIObject

The WebBaseControl defines the API for all controls that participate within the column flow layout 
system. This makes it one of the core classes of the framework. It defines properties like 
piColumnIndex and piColumnSpan and has the API for setting the height of the controls. It can 
generate the wrapping DOM elements (several DIV’s) that almost all controls need where subclasses 
will usually fill these. As every control supports a label this class also generates and positions 
the label.

Revisions:
    2011/08/02 (HW, DAW)
        Initial version.
*/
df.WebBaseControl = function WebBaseControl(sName, oParent){
    df.WebBaseControl.base.constructor.call(this, sName, oParent);
    
    this.prop(df.tInt, "piColumnIndex", 0);
    this.prop(df.tInt, "piColumnSpan", 1);
    
    this.prop(df.tBool, "pbShowLabel", true);
    this.prop(df.tString, "psLabel", "");
    this.prop(df.tInt, "peLabelPosition", 0);
    this.prop(df.tInt, "peLabelAlign", -1);
    this.prop(df.tInt, "piLabelOffset", -1);
    this.prop(df.tString, "psLabelColor", "");
    
    this.prop(df.tString, "psTooltip", "");
    
    this.prop(df.tBool, "pbFillHeight", false);
    this.prop(df.tInt, "piHeight", -1);
    
    this.event("OnFocus", df.cCallModeDefault);
    this.event("OnBlur", df.cCallModeDefault);
        
    //  @privates
    this._eInner = null;
    this._eLbl = null;
    this._eControlWrp = null;
    this._eControl = null;
    
    this._oInfoBalloon = null;
    
    this._sControlId = df.dom.genDomId();
    
    //  Configure super classes
    this._bFocusAble = true;
    this._bHasFocus = false;
    this._sBaseClass = "WebControl";
    
};
df.defineClass("df.WebBaseControl", "df.WebBaseUIObject", {

openHtml : function(aHtml){
    //  Outermost div for positioning by parent, inner div for margins / paddings
    aHtml.push('<div class="', this.genClass(), '"');
    if(this.psHtmlId){
        aHtml.push(' id="', this.psHtmlId, '"');
    }
    aHtml.push(' style=" ',  (this.pbRender ? '' : 'display: none;'), (this.pbVisible ? '' : 'visibility: hidden;'), '"');
    aHtml.push('>');
    
    //  Optionally label
    if(this.pbShowLabel){
        aHtml.push('<div class="WebCon_Inner"><label for="', this._sControlId, '">&nbsp;</label>');
    }else{
        aHtml.push('<div class="WebCon_Inner">');
    }
    
    //  Wrapper div for positioning of control
    aHtml.push('<div>');
},

closeHtml : function(aHtml){
    aHtml.push('</div></div></div>');
},

/*
render : function(){
    return df.WebBaseControl.base.render.call(this);
},
*/
afterRender : function(){
    //  Get references
    this._eInner = df.dom.query(this._eElem, "div.WebCon_Inner");
    this._eControlWrp = df.dom.query(this._eElem, "div.WebCon_Inner > div");
    if(this.pbShowLabel){
        this._eLbl = df.dom.query(this._eElem, "div > label");
    }
    
    df.WebBaseControl.base.afterRender.call(this);
    if(this._eLbl){
        df.events.addDomListener("click", this._eLbl, this.onLblClick, this);
    }
    
    //  Call setters to apply properties
    this.set_psLabel(this.psLabel);
    
    this.posLabel(true);
    this.set_psLabelColor(this.psLabelColor);
    this.set_peLabelAlign(this.peLabelAlign);
    
    this.set_psTooltip(this.psTooltip);
    
    this.sizeHeight(-1);
    
    if(this._oInfoBalloon){
        this._oInfoBalloon.init();
        if(this._bShowInfoBallon){
            this._oInfoBalloon.show();
        }
    }
},

/*
Handler for the click event on the label. It calls the focus method to pass the focus to the 
control. This is done manually here to emulate this behavior for controls with an artificial focus.

@param  oEvent      DOM Event Object.
@private
*/
onLblClick : function(oEvent){
    this.focus();
},



set_psLabel : function(sVal){
    if(this._eLbl){
        if(!sVal){
            sVal = " ";
        }
        df.dom.setText(this._eLbl, sVal);
    }
},

set_pbShowLabel : function(bVal){
    this.pbShowLabel = bVal;
    
    this.posLabel(false);
},

set_psLabelColor : function(sVal){
    if(this._eLbl){
        this._eLbl.style.color = sVal;
    }
},

set_peLabelAlign : function(iVal){
    if(this._eLbl){
        this._eLbl.style.textAlign = (iVal === df.ciAlignLeft ? "left" : (iVal === df.ciAlignCenter ? "center" : (iVal === df.ciAlignRight ? "right" : "")));
    }   
},

set_piLabelOffset : function(iVal){
    this.piLabelOffset = iVal;
    
    this.posLabel(false);
},

set_peLabelPosition : function(iVal){
    this.peLabelPosition = iVal;
    
    this.posLabel(false);
},

set_psTooltip : function(sVal){
    if(this._eControl){
        this._eControl.title = sVal;
    }
},

set_piColumnIndex : function(iVal){
    if(this.piColumnIndex !== iVal){
        this.piColumnIndex = iVal;
        
        this.sizeChanged(true);
    }
},

set_piColumnSpan : function(iVal){
    if(this.piColumnSpan !== iVal){
        this.piColumnSpan = iVal;
        
        this.sizeChanged(true);
    }
},

set_psTextColor : function(sVal){
    if(this._eControl){
        this._eControl.style.color = sVal || '';
    }
},

set_psBackgroundColor : function(sVal){
    if(this._eControl){
        this._eControl.style.background = sVal || '';
        // this._eControl.style.backgroundColor = sVal || '';
        // this._eControl.style.backgroundImage = (sVal ? 'none' :'');
    }
},

set_piMinHeight : function(iVal){
    if(this._eControl){
        if(this.piMinHeight !== iVal){
            this.piMinHeight = iVal;
            if(!this.pbFillHeight){
                this.sizeHeight(-1);
            }
            
            // Call sizing sytem to recalculate sizes
            this.sizeChanged();
        }
    }
},

set_piHeight : function(iVal){
    if(this._eControl){
        if(this.piHeight !== iVal){
            this.piHeight = iVal;
            if(!this.pbFillHeight){
                this.sizeHeight(-1);
            }
            
            // Call sizing sytem to recalculate sizes
            this.sizeChanged();
        }
    }
},

sizeHeight : function(iExtHeight){
    var iHeight = -1;
    
    //  Determine which height to use
    if(this.pbFillHeight){
        iHeight = iExtHeight;
    }else{
        if(this.piHeight > 0){
            iHeight = this.piHeight;
        }
    }
    
    //  Respect minimal height
    if(iHeight < this.piMinHeight){
        iHeight = this.piMinHeight;
    }
    
    //  Update the height
    this.setHeight(iHeight);
    
    //  Return the final height
    if(iHeight > 0){
        return iHeight;
    }
},

/*
Sets the height of the control taking margins, borders and the label into account.

@param  iHeight     The height in pixels.
*/
setHeight : function(iHeight){
    if(this._eControl){
        //  If a negative value is given we should size 'naturally'
        if(iHeight > 0){
            //  If the label is on top we reduce that (note that this means that piMinHeight and piHeight are including the label)
            if(this.peLabelPosition === df.ciLabelTop && this._eLbl){
                iHeight -= this._eLbl.offsetHeight;
            }
            
            //  Substract the wrapping elements
            iHeight -= df.sys.gui.getVertBoxDiff(this._eInner);
            iHeight -= df.sys.gui.getVertBoxDiff(this._eControlWrp);
            iHeight -= df.sys.gui.getVertBoxDiff(this._eControl);
            
            //  Set the height
            this._eControl.style.height = iHeight + "px";
        }else{
            this._eControl.style.height = "";
        }
    
    }
},

/* 
Updates the control its label based on the pbShowLabel, psLabel, peLabelPostion and piLabelOffset 
properties. It will do this by setting CSS Classnames, calculating margins and removing / generating 
the label element. This method is called by the setters of these properties.

@private
*/
posLabel : function(bFirst){
    var iPos = this.peLabelPosition, sClass, sOffset, iOffset = this.piLabelOffset, iMargin, sMargin, oStyle;
    
    if(this._eElem){
        //  Remove all label classes
        if(!bFirst){
            df.dom.removeClass(this._eInner, "WebCon_HasLabel WebCon_TopLabel WebCon_RightLabel WebCon_LeftLabel");
        }
        
        if(!this.pbShowLabel){
            //  Remove from the DOM
            if(this._eLbl){
                df.events.removeDomListener("click", this._eLbl, this.onLblClick);
                this._eLbl.parentNode.removeChild(this._eLbl);
                this._eLbl = null;
            }
            
            this._eControlWrp.style.marginLeft = "";
            this._eControlWrp.style.marginTop = "";
            this._eControlWrp.style.marginRight = "";
        }else{
            //  Add to the DOM 
            if(!this._eLbl){
                this._eLbl = df.dom.create('<label for="' + this._sControlId + '">&nbsp;</label>');
                
                this.set_psLabel(this.psLabel);
                this.set_psLabelColor(this.psLabelColor);
                this.set_peLabelAlign(this.peLabelAlign);
                
                this._eInner.insertBefore(this._eLbl, this._eInner.firstChild);
                
                df.events.addDomListener("click", this._eLbl, this.onLblClick, this);
            }
            if(!bFirst){
                df.dom.addClass(this._eInner, "WebCon_HasLabel");
            }
            
            //  If there is no positions et explicitly we detect it (so we assume where the style sheet wants the label based on the margin it sets)
            if(this.peLabelPosition < 0){
                oStyle = df.sys.gui.getCurrentStyle(this._eLbl);
                
                iPos = (oStyle.marginLeft > 0 ? df.ciLabelLeft : (oStyle.marginRight > 0 ? df.ciLabelRight : df.ciLabelLeft));
            }
            
            //  Determine the classname and the required margin
            switch(iPos){
                case df.ciLabelLeft:
                    sClass = "WebCon_LeftLabel";
                    iMargin = (iOffset > 0 ? iOffset + df.sys.gui.getHorizBoxDiff(this._eLbl, 1) : 0);
                    break;
                case df.ciLabelTop:
                    sClass = "WebCon_TopLabel";
                    iMargin = (iOffset > 0 ? iOffset + df.sys.gui.getVertBoxDiff(this._eLbl, 1) : 0);
                    break;
                case df.ciLabelRight:
                    sClass = "WebCon_RightLabel";
                    iMargin = (iOffset > 0 ? iOffset + df.sys.gui.getHorizBoxDiff(this._eLbl, 1) : 0);
                    break;
            }
            
            sOffset = (iOffset > 0 ? iOffset + "px" : "");
            sMargin = (iMargin > 0 ? iMargin + "px" : "");
              
            //  Make space
            this._eControlWrp.style.marginLeft = (iPos === df.ciLabelLeft ? sMargin : "");
            this._eControlWrp.style.marginTop = (iPos === df.ciLabelTop ? sMargin : "");
            this._eControlWrp.style.marginRight = (iPos === df.ciLabelRight ? sMargin : "");
            
            this._eLbl.style.width = (iPos === df.ciLabelLeft ||  iPos === df.ciLabelRight ? sOffset : "");
            this._eLbl.style.height = (iPos === df.ciLabelTop ? sOffset : "");
            
            //  Set CSS class on the inner div
            df.dom.addClass(this._eInner, sClass);
            
        }
    }
},


// - - - - - - - Information Balloon API - - - - - - - 
/* 
Used by the InfoBalloon class to determine where to align the info ballon on to.

@private
*/
getBalloonElem : function(){
    return this._eControlWrp;
},

/*
Shows the info balloon with the provided CSS classname and content (html). 

@param  sCssClass   The CSS classname applied to the balloon for styling.
@param  sText       The HTML content displayed inside the balloon.
@client-action
*/
showInfoBalloon : function(sCssClass, sText, bShow){
    bShow = df.toBool(bShow);

    if(this._oInfoBalloon){
        this._oInfoBalloon.psCssClass = sCssClass;
        this._oInfoBalloon.psMessage = sText;
        this._oInfoBalloon.update();
    }else{
        this._oInfoBalloon = new df.InfoBalloon(this, sCssClass, sText);
    }
    if(this._eElem){
        this._oInfoBalloon.init();
        
        if(bShow){
            this._oInfoBalloon.init();
        }
    }else{
        this._bShowInfoBallon = bShow;
    }
},

/* 
Hides the info balloon that is shown using showInfoBalloon.

@client-action
*/
hideInfoBalloon : function(){
    if(this._oInfoBalloon){
        this._oInfoBalloon.hide();
    }
},

/*
Implement the resize method to resize & reposition the info balloon (if displayed).
*/
resize : function(){
    if(this._oInfoBalloon){
        this._oInfoBalloon.resize();
    }
},


// - - - - - - - - - Focus Handling - - - - - - - - - 
focus : function(){
    if(this._bFocusAble && this.pbEnabled && this._eControl && this._eControl.focus){
        try{
            this._eControl.focus();
        }catch (oErr){
            
        }
        
        return true;
    }
    
    return false;
},

attachFocusEvents : function(){
    //  We are attaching a DOM capture listener so we know when we get the focus
    if(window.addEventListener){
        df.events.addDomCaptureListener("focus", this._eElem, this.onFocus, this);
        df.events.addDomCaptureListener("blur", this._eElem, this.onBlur, this);
    }else{
        df.events.addDomListener("focusin", this._eElem, this.onFocus, this);
        df.events.addDomListener("focusout", this._eElem, this.onBlur, this);
    }
},

onFocus : function(oEvent){
    df.WebBaseControl.base.onFocus.call(this, oEvent);
    
    if(this._eElem){
        df.dom.addClass(this._eElem, "WebCon_Focus");
    }
    
    this.fire("OnFocus");
    
    this._bHasFocus = true;
},

onBlur : function(oEvent){
    df.WebBaseControl.base.onBlur.call(this, oEvent);
    
    if(this._eElem){
        df.dom.removeClass(this._eElem, "WebCon_Focus");
    }
    
    this.fire("OnBlur");
    
    this._bHasFocus = false;
}
});