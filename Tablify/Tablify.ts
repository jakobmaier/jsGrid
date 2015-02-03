﻿/// <reference path="lib/jQuery/jquery.d.ts"/>
/// <reference path="Debugging.ts" />
/// <reference path="TypeDefinitions.ts" />

/*
Other libs:
    http://webix.com/demo/datatable/
    http://www.datatables.net/blog/2014-11-07
    http://lorenzofox3.github.io/smart-table-website/
*/

module Tablify {
    "use strict";

    /*
     * Converts any Array or Object into a Table. Recursion is possible.
     * @object      Object      The table will have 2 rows: The first (title) row contains the key, the second (body) row the object's value.
     *              Array       The table will have 2 rows: The first (title) row contains the array index, the second (body) row the array's value.
     *              any         Any other type (string, number, function,...) will result in a table containing 2 cells: The first (top/title) cell contains the type ("typeof object"), eventually following by "(RegExp)" or "(Date)", the second (bottom/body) cell contains the result of "object.toString()"
     * @target      string      JQuery-Selector. Is resolved to a JQuery element (see below)
     *              JQuery      References a single HTMLElement. If the Element is a <table> (HTMLTableElement), the Table is initialised with the table content; Otherwise, a new table is generated within the HTMLElement
     *              Element     Target element. Is converted to a JQuery element (see above)
     * @return      Table       Returns the generated Table instance.
     * Note: If an array or object is passed and one of it's fields is another array/object, tablify is called recursive, leading in nested tables. The return value represents the top table.
     */
    export function tablify(object: Object|Array<any>|any, target?: Selector): Table {                
        if (object instanceof Array) {
            var table = new Table({
                rows: [ "index", "value" ],
                titleRowCount: 1
            }, target);
            for (var i = 0; i < object.length; ++i) {
                var index: string = i.toString();
                table.addColumn({
                    columnId:   index,
                    content: {  "index": index,
                                "value": (typeof object[i] !== "object") ? object[i].toString() : tablify(object[i])
                    }
                });
            }
            return table;
        }
        
        if (typeof object === "object" && !(object instanceof Date) && !(object instanceof RegExp)) {      
            var table = new Table({
                rows: [ "key", "value" ],   
                titleRowCount: 1
            }, target);

            for (var key in object) {
                if (!object.hasOwnProperty(key)) {
                    continue;
                }
                table.addColumn({
                    columnId: key,
                    content: {  "key": key,
                                "value": (typeof object[key] !== "object") ? object[key].toString() : tablify(object[key])
                    }
                });
            }
            return table;
        }

        //Convert any other type into a table:
        var table = new Table({
            columns: [null],
            rows: [{
                rowId: "type",
                content: (object instanceof RegExp) ? "object(RegExp)" : 
                         (object instanceof Date) ? "object(Date)" : typeof object
            }, {
                rowId: "value",
                content: object.toString()
            }],
            titleRowCount: 1
        }, target);        
        return table;
    }


    /*
     * [Internal]
     * Checks if the given argument is an HTMLElement (type "Element").
     * @something       any         Any object that might be of type "Element"
     * @return          boolean     true: It is an Element; otherwise: false
     */
    export function isElement(something: any): boolean {
        //Source: http://stackoverflow.com/a/384380/2224996
        return (
            typeof HTMLElement === "object" ? something instanceof HTMLElement : //DOM2
            something && typeof something === "object" && something !== null && something.nodeType === 1 && typeof something.nodeName === "string"
        );
    }

    /*
     * [Internal]
     * Resolves a Selector and returns the appropiate JQuery Object.
     * If the selector doesn't reference exacly ONE Element, null is being returned.
     * @selector    string      JQuery selector string
     *              Element     The HTMLElement will be wrapped in a JQuery element
     *              JQuery      The object's length is checked for 1 and then directly returned
     * @return      JQuery      Returns the JQuery element that references exacly one HTMLElement. If this is not possible, null is being returned
     */
    export function resolveUniSelector(selector: Selector): JQuery{
        if (isElement(selector)){               //Element
            return $(selector);
        }
        if (typeof selector === "string") {     //selector
            selector = $(selector);
        }
        //JQuery        
        if ((<JQuery>selector).length !== 1) {
            return null;
        }
        return <JQuery>selector;
    }
}


//Extends all native objects with a tablify-method
//This functionality has been removed though, see http://stackoverflow.com/a/28305414/2224996
//interface Object{
//    tablify(target?: Tablify.Selector): Tablify.Table;
//}
//Object.defineProperty(Object.prototype, 'tablify', {
//    value: function (target?: Tablify.Selector): Tablify.Table {
//        "use strict";
//        return Tablify.tablify(this, target);
//    },
//    writable:     true,   //The property may be changed with an assignment operator
//    configurable: true,   //The property may be changed or deleted from an object
//    enumerable:   false   //The property should not show up during enumeration ("for-in" loops)
//});
