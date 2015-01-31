﻿/// <reference path="lib/jQuery/jquery.d.ts"/>
/// <reference path="Debugging.ts" />
/// <reference path="TypeDefinitions.ts" />


/*
Other libs:
    http://webix.com/demo/datatable/
    http://www.datatables.net/blog/2014-11-07
    http://lorenzofox3.github.io/smart-table-website/
*/

type Row = string;

module JsGrid {
    /*
     * Contains all Tables, that are currently active on the web page.
     */
    class TableStore {
        /*readonly*/ tableList: Table[] = [];  //List of all Tables that are available on the page. This list is neccessary in order to find/retrieve Table objects by an element selector
      
        //Callback handlers:
        onTableRegistered: (table: Table) => void = null;
        onTableUnregistered: (table: Table) => void = null;



        /*
         * Returns the Table-instance that manages a specific HTMLTableElement. If the given HTMLElement is not managed by any Table instance, null is returned
         * @table   JQuery      References an HTMLTableElement. If this HTMLTableElement is managed by an existing table object, the corresponding object is returned
         * @return  Table       The Table-Object that manages the given HTTMLTableElement. If the Element isn't managed, null is being returned.
         */
        getTableByElement(table: JQuery): Table {
            for (var i = 0; i < this.tableList.length; ++i) {
                if (this.tableList[i].representsTable(table)) {
                    return this.tableList[i];
                }
            }
            return null;
        }

        /*
         * Returns the Table-instance with a specific id. If the id does not exist, null is returned
         * @gridId  string      gridId of the table, whose instance should be returned
         * @return  Table       The Table-Object with the given gridId. If the id does not exist, null is being returned.
         */
        getTableById(gridId: string): Table {
            assert_argumentsNotNull(arguments);
            for (var i = 0; i < this.tableList.length; ++i) {
                if (this.tableList[i].gridId === gridId) {
                    return this.tableList[i];
                }
            }
            return null;
        }

        /*
         * Adds a table to the internal list
         */
        registerTable(table: Table): void {
            assert_argumentsNotNull(arguments);
            this.tableList.push(table);
            if (typeof this.onTableRegistered === "function") {
                this.onTableRegistered(table);
            }
        }

        /*
         * Removes a table from the internal list
         */
        unregisterTable(table: Table): void {
            assert_argumentsNotNull(arguments);
            for (var i = 0; i < this.tableList.length; ++i) {
                if (this.tableList[i] === table) {
                    this.tableList.splice(i, 1);
                    if (typeof this.onTableUnregistered === "function") {
                        this.onTableUnregistered(table);
                    }
                    return;
                }
            }
            logger.error("Unregister table failed. No such table in the list.");
        }
    };
    export var tableStore: TableStore = new TableStore();    //Singleton





  
    export class Table {
        //References to commonly used HTML elements:
        /*readonly*/ table: JQuery; //<table>
        private thead: JQuery;      //<thead>
        private tbody: JQuery;      //<tbody>

    
        private static gridIdSequence: number = 0;      //Used to auto-generate unique ids
        private _gridId: string;                        //Unique grid id
        get gridId(): string {
            return this._gridId;
        }

        //Column properties:
        private columns: { [key: string]: Column; } = {};        // { "columnId": Column, ... }
        //var columns: Map<string, Column>;             //better alternative to the above definition. However, this is part of EcmaScript6 and currently not supported very well

        //Table content - each row is referenced twice for faster access:
        private titleRows: Row[] = [];                  // Rows, which are part of the table head. Sorted by their output order.
        private bodyRows: Row[] = [];                   // Rows, containing the data. Sorted by their output order.
        private rows: { [key: string]: Row; } = {};     //All rows, sorted by their ID
 
        /*
         * Generates a new JsGrid Table
         * @identifier      string              JQuery-Selector. Is resolved to a JQuery element (see below)
         *                  JQuery              References a single HTMLElement. If the Element is a <table> (HTMLTableElement), the JsGrid is initialised with the table content; Otherwise, a new table is generated within the HTMLElement
         * @description     TableDescription    Data, how the table should look like (rows / columns / ...). Used for deserialisation.
         */
        constructor(identifier: string|JQuery, description?: TableDescription) {
            this._gridId = "jsg" + (++Table.gridIdSequence);
            if (typeof identifier === "string") {
                this.table = $(identifier);                     //selector
            } else {
                this.table = identifier;                        //jQuery
            }
            if (this.table == null) {                           //No table found                
                logger.error("Unable to find DOM Element", identifier);
                return;
            }

            if (this.table.prop("tagName") !== "TABLE") {       //Create a new table within this element
                logger.log("Creating table element. Parent tag: ", this.table.prop("tagName"));
                var table = $("<table><thead></thead><tbody></tbody></table>");
                this.table.append(table);
                this.table = table;
            } else if (this.table.hasClass("jsGrid")){          //Maybe the table has already been initialised with a jsGrid? If yes, return the already existing object and don't create a new one
                var existingObj = tableStore.getTableByElement(this.table);
                if (existingObj !== null) {                     //The table is already managed by another Table-instance
                    logger.warning("The given HTML element is already managed by another Table instance (\""+existingObj._gridId+"\"). The old instance will be returned instead of creating a new one.");
                    return existingObj;
                }
            }
            this.table.addClass("jsGrid");
            tableStore.registerTable(this);

            this.thead = this.table.find("thead");
            this.tbody = this.table.find("tbody");

            if (!description) {     //No content to generate
                return;
            }
        //Generate the table content:
            for (var i = 0; i < description.columns.length; ++i) {
                this.addColumn( description.columns[i] );
            }
            var titleRowCount = description.titleRowCount || 0;
            for (var i = 0; i < description.rows.length; ++i) {
                this.addRow(titleRowCount > i ? RowType.title : RowType.body, description.rows[i]);
            }
        }
        
        /*
         * Returns true, if the object represents the given table-element
         * @table   JQuery      References a HTMLElement. If this HTMLElement is managed by this table object, true is returned
         * @return  boolean     true: The given HTMLElement (<table>) is managed by this Table-instance. Otherwise, false is returned
         */
        representsTable(table: JQuery): boolean {
            return (this.table === table);
        }

        /*
         * Destroys the JsGrid Table. This object will get unusable.
         */
        destroy(): void {
            tableStore.unregisterTable(this);
            this.table.removeClass("jsGrid");
            this.table = null;
            this.rows = null;
            this.columns = null;
        }
    

        /*
         * Adds a new column to the table.
         * @column      null / undefined            The columnId is generated automatically
         *              string                      ColumnId. The cells of the newly generated column will be empty.
         *              Column                      The column will be deep-copied. Note that the new object will have the same columnId
         *              ColumnDefinitionDetails     Contains detailed information on how to generate the new column.
         *              ColumnDescription           Used for deserialisation.
         */
        addColumn(columnDef?: ColumnDefinition|ColumnDescription): void {
            var column = new Column(columnDef);
            var columnId: string = column.columnId;
            if (columnId in this.columns) {
                logger.error("There is already a column with the id \"" + columnId + "\".");
                return;
            }
            this.columns[columnId] = column;

            var content: { [key: string]: CellDefinition; } = {};
            if (columnDef && typeof columnDef !== "string" && !(columnDef instanceof Column)) {     //ColumnDefinitionDetails / ColumnDescription
                content = (<ColumnDefinitionDetails>columnDef).content || {};
            }
            
            //Add a new cell to each row:
            for (var rowId in this.rows) {
                var row: Row = this.rows[rowId];
                var cell: CellDefinition;
                if (rowId in content) {     //The user passed a definition on how to create this cell
                    cell = content[rowId];
                } else {
                    switch (row.rowType) {
                        case RowType.title: cell = column.defaultTitleContent; break;
                        case RowType.body: cell = column.defaultBodyContent; break;
                        default: assert(false, "Invalid RowType given.");
                    }
                }
                row.addColumn(column, cell);
            }
            if (inputValidation) {  //Check if the columnDefinition has some invalid data
                for (var rowId in content) {
                    logger.warningIf(!(rowId in this.rows), "The column definition of column \"" + column.columnId + "\" contains data for row \"" + rowId + "\", although there is no such row.");
                }
            }
        }


        /*
         * Adds a new row to the table
         * @rowType     RowType                 The type of the row (title, body, footer)
         * @rowDef      null / undefined        The rowId is generated automatically.
         *              string                  RowId. The cells of the newly generated row will be created using the column's default values.
         *              Row                     The row will be deep-copied. Note that the new object will have the same rowId.
         *              RowDefinitionDetails    Contains detailed information on how to generate the new row.
         *              RowDescription          Used for deserialisation.
         */
        addRow(rowType: RowType, rowDef?: RowDefinition|RowDescription): void {
            var row = new Row(rowType, rowDef, this.columns);
            var rowId: string = row.rowId;
            
            if (rowId in this.rows) {
                logger.error("There is already a row with the id \"" + rowId + "\".");
                return;
            }
            this.rows[rowId] = row;
            switch (rowType) {
                case RowType.title: this.titleRows.push(row);
                    this.thead.append(row.generateDom());       //Add the row to the table-head
                    break;
                case RowType.body: this.bodyRows.push(row);
                    this.tbody.append(row.generateDom());       //Add the row to the table-body
                    break;
                default:    assert(false, "Invalid RowType given.");
            }         
        }


        /*
         * Converts the Table into an object. Used for serialisation.
         * Performs a deepCopy.
         * @includeContent      boolean             true (default): The data is included in the object as well. Otherwise, the returned object only contains meta data. 
         * @return              TableDescription    DeepCopy of this table
         */
        toObject(includeContent?: boolean): TableDescription {
            var description: TableDescription = {
                columns: [],
                rows: [],
                titleRowCount: this.titleRows.length
            };
            for (var columnId in this.columns) {
                description.columns.push(this.columns[columnId].toObject());
            }
            for (var i = 0; i < this.titleRows.length; ++i) {
                description.rows.push(this.titleRows[i].toObject(includeContent));
            }
            for (var i = 0; i < this.bodyRows.length; ++i) {
                description.rows.push(this.bodyRows[i].toObject(includeContent));
            }
            return description;
        }
          
    }
}













window.onload = () => {
    //new JsGrid.Table("#content>table");
    var grid = new JsGrid.Table("#content");

    grid.addColumn(/*"Column 1"*/);
    grid.addColumn({
        //columnId: "Column 2",
        defaultTitleContent: "2. Spalte",
        defaultBodyContent: "---"
    });

    grid.addRow(JsGrid.RowType.title, "Title row");

    grid.addRow(JsGrid.RowType.body, {
        //rowId: "First row",
        content: {
            "jsc1": new JsGrid.Cell("First cell"),
            "jsc2": "Second cell"
        }
    });

    grid.addRow(JsGrid.RowType.title, {
        content: {
            "jsc1": new JsGrid.Cell("column 1"),
            "jsc2": "column 2"
        }
    });


    grid.addRow(JsGrid.RowType.body, {
        //rowId: "Second row",
        content: {
            "jsc1": "!!!"
        }
    });/*
    grid.addColumn({
        columnId: "Column 3",
        defaultTitleContent: "InvisibleTitle",
        defaultBodyContent: "<b>That's what I call a cell!</b>",
        content: {
            "jsr1": "3x1",
            "Title row": "Title of Nr. 3"
        }
    });*/
    grid.addRow(JsGrid.RowType.body);
    grid.addRow(JsGrid.RowType.body);
    grid.addRow(JsGrid.RowType.body);
    grid.addRow(JsGrid.RowType.body);
    grid.addRow(JsGrid.RowType.body);




    //console.log(grid.toObject());
    console.log(JSON.stringify(grid.toObject(true)));


    new JsGrid.Table("#content", grid.toObject(true));
    new JsGrid.Table("#content", grid.toObject(false));

    var copyTable = new JsGrid.Table(grid.table);
    console.log(copyTable === grid);
};

