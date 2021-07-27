/*
Class:
    df.WebMenuItem
Extends:
    df.WebBaseUIObject

This is the client-side representation of the WebMenuItem class that renders the HTML for the menu 
item. 
    
Revision:
    2011/10/04  (HW, DAW) 
        Initial version.
*/

df.WebMenuItem = function WebMenuItem(oDef, oParent){
    df.WebMenuItem.base.constructor.call(this, oDef, oParent);
    
    this.prop(df.tString, "psCaption", "");
    this.prop(df.tString, "psTextColor", "");
    this.prop(df.tBool, "pbBeginGroup", false);
    this.prop(df.tString, "psImage", "");
    this.prop(df.tString, "psToolTip", "");
    
    this.event("OnClick", df.cCallModeWait);
    this.prop(df.tString, "psLoadViewOnClick", "");
    
    // @privates
    this._eSubMenu = null;
    this._eIcon = null;
    this._eWrap = null;
    
    this._bRenderChildren = true;
    this._bWrapDiv = false;
    this._sControlClass = "WebMenuItem";
    this._tHideTimout = null;
    this._bSubShown = false;
    
    this._bHasSubMenu = false;
    this._bIsMenuItem = (oParent instanceof df.WebMenuBar);
    this._bIsToolbarItem = (oParent instanceof df.WebToolBar);
    
    this._bHideOnMouseOut = false;
    
    //  Configure super classes
    this._bFocusAble = true;
    
};
/*
This class represents a menu item inside a menu or a toolbar. It belongs to the server-side 
cWebMenuItem class and implements its functionality on the client. It has support for icons a 
caption and sub menus. The submenu's are shown when hovering the element and hidden after a timeout 
(or a click). The CSS (class: WebMenuItem & WebMenuBar & WebToolBar) heavily determines the looks of 
the control.

@code
<li class="WebUIObj WebMenuItem">
    <div title="Order Entry View">
        <span class="WebItm_Icon" style="background-image: url(&quot;Images/Order.png&quot;);">&nbsp;</span>
        <a href="javascript: df.sys.nothing();">Order Entry View</a>
    </div>
</li>
@code
*/
df.defineClass("df.WebMenuItem", "df.WebBaseUIObject",{

//  - - - Rendering - - -

/*
The WebMenuItem generates its own HTML and doesn't use the wrapper DIV from the superclass. The ul 
element for the submenu is optional.

@param  aHtml   String builder array to add the HTML to.

@private
*/
openHtml : function(aHtml){
    df.WebMenuItem.base.openHtml.call(this, aHtml);
    
    aHtml.push('<li class="', this.genClass(), '"');
    aHtml.push(' style=" ',  (this.pbRender ? '' : 'display: none;'), (this.pbVisible ? '' : 'visibility: hidden;'), '"');
    aHtml.push('><div><span class="WebItm_Icon">&nbsp;</span><a href="javascript: df.sys.nothing();">nbsp;</a></div>');
    
    if(this._bHasSubMenu){
        aHtml.push('<ul style="display: none">');
    }
},

/*
Properly close the opened HTML elements.

@param  aHtml   String builder array to add the HTML to.

@private
*/
closeHtml : function(aHtml){
    if(this._bHasSubMenu){
        aHtml.push('</ul>');
    }
    aHtml.push('</li>');
    
    df.WebMenuItem.base.closeHtml.call(this, aHtml);
},

/*
This initializer method allows us to do properly initialize the DOM elements after they are added. 
We get references to generated elements, attach listeners and call the setters.

@private
*/
afterRender : function(){
    //  Get references
    this._eControl = df.dom.query(this._eElem, "a");
    this._eIcon = df.dom.query(this._eElem, "div > span.WebItm_Icon");
    
    df.WebMenuItem.base.afterRender.call(this);
    
    //  Attach listeners
    df.events.addDomListener("click", this._eElem, this.onItemClick, this);
    df.events.addDomListener("keydown", this._eControl, this.onKeyDown, this);
    
    
    
    df.events.addDomListener("mouseover", this._eElem, this.onMouseOver, this);
    df.events.addDomListener("mouseout", this._eElem, this.onMouseOut, this);
    
    
    df.dom.disableTextSelection(this._eElem);
    
    //  Call setters
    this.set_psCaption(this.psCaption);
    this.set_pbBeginGroup(this.pbBeginGroup);
    this.set_psImage(this.psImage);
    this.set_psToolTip(this.psToolTip);
    
},

/*
We need to augment the renderChildren method because the children need to be added to the ul 
element.

@private
*/
renderChildren : function(eContainer){
    //  Get a reference to the UL of the submenu
    this._eSubMenu = df.dom.query(this._eElem, "ul");
    
    //  Tell base to render children in the submenu
    df.WebMenuItem.base.renderChildren.call(this, this._eSubMenu);
},



//  - - - Event handlers - - -

/*
This method handles the onclick event of li DOM element. If the control is enabled this means that 
we fire the OnClick event and hide the menu.

@param  oEvent  DOM Event object (see: df.events.DOMEvent)
@private
*/
onItemClick : function(oEvent){
    if(this.isActive()){
        this.select();
        this.notifyReceived();
        this.getMaster()._bShownByHover = false;
        
        this.fire('OnClick', [], function(oEvent){
            //  Determine if a view needs to be loaded
            if(!oEvent.bCancelled){
                if(this.psLoadViewOnClick){
                    this.getWebApp().showView(this.psLoadViewOnClick);
                }
            }
            
            if(oEvent.bClient || oEvent.bServer || this.psLoadViewOnClick){
                this.hide();
                this.getWebApp().returnFocus();
            }
        });
    }
    
    //  Stop the event to make sure that we don't bubble to parent menu items
    oEvent.stop();
},

/*
Handles the onmouseover and shows the submenu if needed. This depends on the location within the 
menu and the pbShowOnHover setting. It also highlights (selects) the current item and notifies the 
engine that it shouldn't hide the menu.

@param  oEvent  DOM Event object (see: df.events.DOMEvent)
@private
*/
onMouseOver : function(oEvent){

    if(this._bIsMenuItem){
        if(this._oParent.pbShowOnHover){
            this.getMaster()._bShownByHover = true;
            this.select();
        }else if(this._oParent.hasOpenChild()){ 
            this.select();
        }    
    }else if(!this._bIsToolbarItem){
        this.select();
    }
    this.notifyReceived();
    oEvent.stop();
},

/*
Handles the onmouseout and notifies the engine so that it can start a timer to hide the menu.

@param  oEvent  DOM Event object (see: df.events.DOMEvent)
@private
*/
onMouseOut : function(oEvent){
    this.notifyLost(true);
    oEvent.stop();
},

//  - - - Public API - - - 

/*
This method directly hides the submenu (if there is one available).

@param  bParent     If true this method calls its parent as well.
*/
hideSub : function(bParent){
    var i;
    
    if(this._eSubMenu){
        //  Cancel timer and set properties
        this._bSubShown = false;
        
        //  Update style
        df.dom.removeClass(this._eElem, "WebItm_Expanded");
        this._eSubMenu.style.display = "none";
        
        //  Notify children
        for(i = 0; i < this._aChildren.length; i++){
            if(this._aChildren[i] instanceof df.WebMenuItem){
                this._aChildren[i].hideSub();
                this._aChildren[i].afterHide();
            }
        }
        
        //  Bubble up to parent
        if(bParent){
            if(this._oParent instanceof df.WebMenuItem){
                this._oParent.hideSub(true);
            }
        }
        
        if(this.getWebApp()){
            this.getWebApp().notifyLayoutChange(this);
        }

    }
},

/*
This method shows the sub-menu. Note that this will directly close sub menu's of sibling menu items.
*/
showSub : function(){
    var i;
    
    if(!this._bSubShown){
        this.hideSiblings();
    }
    
    if(this._eSubMenu){    
        this._bSubShown = true;
        
        df.dom.addClass(this._eElem, "WebItm_Expanded");
        
        this.positionSubMenu();
        
        this._eSubMenu.style.display = "block";
        
        for(i = 0; i < this._aChildren.length; i++){
            if(this._aChildren[i] instanceof df.WebMenuItem){
                this._aChildren[i].afterShow();
            }
        }
        
        if(this.getWebApp()){
            this.getWebApp().notifyLayoutChange(this);
        }
    }
},

/* 
This function positions the sub menu if that is needed. Positioning is only done for the sub-menu's 
of root level items. This menu is positioned using fixed coordinates and is aligned below the menu 
item itself.
*/
positionSubMenu : function(){
    var oRect;
    
    if(this._bIsMenuItem || this._bIsToolbarItem){
        oRect = this._eElem.getBoundingClientRect();
        
        this._eSubMenu.style.top = oRect.bottom + "px";
        this._eSubMenu.style.left = oRect.left + "px";
    }
},

/*
This method makes sure that this item is shown when being used in a menu. It will also show the 
submenu of the current item. It does this by going up in the menu structure and making sure the 
items are expanded. Note that this method ignores the enabled state. The menu will be hidden as 
soon as it is hovered with the mouse.
*/
show : function(){
    var aItems = [], oItem = this;
    
    while(oItem && oItem instanceof df.WebMenuItem){
        aItems.push(oItem);
        
        oItem = oItem._oParent;
    }
    
    while(oItem = aItems.pop()){
        oItem.showSub();
    }
    
    this.notifyReceived();
},

/*
This method hides the submenu and bubbles up in the menu structure hiding all items. It doesn't hide 
when the item is hovered by the mouse.
*/
hide : function(){
    var oItem = this;
    
    while(oItem && oItem instanceof df.WebMenuItem){
        oItem.hideSub();
        oItem = oItem._oParent;
    }
},

/*
This method hides the submenu's of sibling menu items.
*/
hideSiblings : function(){
    var i, aSiblings;
    
    if(this._oParent){
        aSiblings = this._oParent._aChildren || [];
    
        for(i = 0; i < aSiblings.length; i++){
            if(aSiblings[i] instanceof df.WebMenuItem){
                aSiblings[i].hideSub();
            }
        }
    }
},

select : function(){
    var oMaster = this.getMaster();
    
    if(this.isActive()){
        if(oMaster._oSelectedItem && oMaster._oSelectedItem !== this){
            oMaster._oSelectedItem.deSelect();
        }
        oMaster._oSelectedItem = this;
        
        this.focus();
        this.showSub();
        
        df.dom.addClass(this._eElem, "WebItm_Selected");
        
        // df.debug("Select: " + this.getLongName());
        return true;
    }
    
    return false;
},

deSelect : function(){
    df.dom.removeClass(this._eElem, "WebItm_Selected");
},

selectChild : function(){
    var i;
    
    for(i = 0; i < this._aChildren.length; i++){
        if(this._aChildren[i] instanceof df.WebMenuItem){
            if(this._aChildren[i].select()){
                return true;
            }
        }
    }
    
    return false;
},

selectSibling : function(iDir){
    var i, aSiblings;
    
    if(this._oParent && iDir !== 0){
        aSiblings = this._oParent._aChildren || [];
        
        i = aSiblings.indexOf(this);
        
        if(i >= 0){
            while(i >= 0 && i < aSiblings.length){
                i+= iDir;
                
                if(aSiblings[i] instanceof df.WebMenuItem){
                    if(aSiblings[i].select()){
                        this.hideSub();
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
},

selectParent : function(){
    if(this._oParent && this._oParent instanceof df.WebMenuItem){
        return this._oParent.select();
    }
    
    return false;
},

selectRootSibling : function(iDir){
    var oItem = this;
    
    while(oItem && oItem instanceof df.WebMenuItem){
        if(oItem._bIsMenuItem){
            return oItem.selectSibling(iDir);
        }
        oItem = oItem._oParent;
    }
    
    return false;
},

notifyLost : function(bMouseOut){
    var oMaster = this.getMaster();
    
    if(!bMouseOut || oMaster._bShownByHover){
        // df.debug("Lost: " + this.getLongName());
        if(oMaster._tHideTimeout){
            clearTimeout(oMaster._tHideTimeout);
        }
        oMaster._tHideTimeout = setTimeout(function(){
            oMaster._tHideTimeout = null;
            oMaster.hideSub();
            if(oMaster._oSelectedItem){
                oMaster._oSelectedItem.deSelect();
                oMaster._oSelectedItem = null;
            }
            if(bMouseOut && oMaster._bShownByHover){
                oMaster.getWebApp().returnFocus();
            }
        }, 500);
    }
},

notifyReceived : function(){
    var oMaster = this.getMaster();
    // df.debug("Received: " + this.getLongName());
    if(oMaster._tHideTimeout){
        clearTimeout(oMaster._tHideTimeout);
        oMaster._tHideTimeout = null;
    }
},

getMaster : function(){
    if(this._oParent instanceof df.WebMenuItem){
        return this._oParent.getMaster();
    }
    if(this._oParent instanceof df.WebMenuBar){
        return this._oParent;
    }
    return this;
},

//  - - - Setters - - - 

/*
This setter method updates the DOM with the new caption.

@param  sVal   The new value.
@private
*/
set_psCaption : function(sVal){
    if(this._eControl){
        //  Replace the first occurence of & (which is used to indicate keyboard shortcuts in windows)
        sVal = sVal.replace("&", "");
        
        df.dom.setText(this._eControl, sVal);
    }
},

/*
This setter method updates the DOM with the new tooltip.

@param  sVal   The new value.
@private
*/
set_psToolTip : function(sVal){
    if(this._eControl){
        this._eElem.title = sVal;
        // this._eControl.title = sVal;
        // this._eIcon.title = sVal;
    }
},

/*
This setter method adds or removes the CSS class that shows the group line.

@param  bVal   The new value.
@private
*/
set_pbBeginGroup : function(bVal){
    if(this._eElem){
        df.dom.toggleClass(this._eElem, "WebItm_BgnGroup", bVal);
    }
},

/*
This setter method updates the background-image style property of the icon element.

@param  sVal   The new value.
@private
*/
set_psImage : function(sVal){
    if(this._eElem){
        df.dom.toggleClass(this._eElem, "WebItm_HasIcon", sVal);
    
        this._eIcon.style.backgroundImage = (sVal ? "url('" + sVal + "')" : "");
    }
},

//  - - - Control / container stuff - - - 

/*
This method augments the method that generates the full CSS classname and adds the 'WebItm_HasSub' 
class when sub items are available.

@param  sVal   The new value.
@private
*/
genClass : function(){
    var sClass = df.WebMenuItem.base.genClass.call(this);
    
    if(this._bHasSubMenu){
        sClass += " WebItm_HasSub";
    }
    
    return sClass;
},

/*
We need to know if there are child menu items.

@private
*/
addChild : function(oChild){
    if(oChild instanceof df.WebMenuItem){
        this._bHasSubMenu = true;
    }
    df.WebMenuItem.base.addChild.call(this, oChild);
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
    //df.WebBaseControl.base.onFocus.call(this, oEvent);
    
    if(this._eElem){
        df.dom.addClass(this._eElem, "WebCon_Focus");
    }
    // df.log("Received Focus: " + this.getLongName());
    this.notifyReceived();
    
    this._bHasFocus = true;
},

onBlur : function(oEvent){
    //df.WebBaseControl.base.onBlur.call(this, oEvent);
    
    if(this._eElem){
        df.dom.removeClass(this._eElem, "WebCon_Focus");
    }
    
    this.notifyLost(false);
    
    this._bHasFocus = false;
},

focus : function(){
    if(this._bFocusAble && this.pbEnabled && this._eElem && this._eElem.focus){
        this._eControl.focus();
        // df.log("Focus: " + this.getLongName());
        
        return true;
    }
    
    return false;
},


/*

@param  oEvent  The event object.

*/
onKeyDown : function(oEvent){
    var bRes = false;
    
    if(oEvent.matchKey(df.settings.menuKeys.moveUp)){
        if(this._bIsMenuItem){
            this.hideSub(false);
        }else{
            this.selectSibling(-1);
        }
        bRes = true;
    }else if(oEvent.matchKey(df.settings.menuKeys.moveDown)){ 
        if(this._bIsMenuItem){
            this.selectChild();
            this.showSub();
        }else{
            this.selectSibling(1);
        }
        bRes = true;
    }else if(oEvent.matchKey(df.settings.menuKeys.moveLeft)){ 
        if(this._bIsMenuItem){
            this.selectSibling(-1);
        }else{
            if(this._oParent && !this._oParent._bIsMenuItem){
                this.selectParent();
                if(this._bSubShown){
                    this.hideSub();
                }
            }else{
                this.selectRootSibling(-1);
            }
        }
        bRes = true;
    }else if(oEvent.matchKey(df.settings.menuKeys.moveRight)){ 
        if(this._bIsMenuItem){
            this.selectSibling(1);
        }else{
            if(this._bHasSubMenu){
                this.selectChild();
            }else{
                this.selectRootSibling(1);
            }            
        }
        bRes = true;
    }
    
    if(bRes){
        oEvent.stop();
        this.getMaster()._bShownByHover = false;
    }
}



});