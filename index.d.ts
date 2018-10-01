interface IQueryOption {
    source: string;
}

interface IQuery<T> {
    /**
     * subscribe query onSnapshot with options and return unsubscribe function
     * @param options
     * @param callback
     */
    subscribe(options, callback: Function): Function;

    /**
     * subscribe query onSnapshot and return unsubscribe function
     * @param callback
     */
    subscribe(callback: Function): Function;

    /**
     * remove all subscriptions
     */
    unsubscribeAll(): IQuery<T>;

    /**
     * query will return set of result of specific selector
     * using '@id' to select document id
     * .select(function(documentData, originalDocumentObject) {
     *     return {
     *
     *     };
     * })
     * @param selector
     */
    select<U>(selector: (data: T, document?: any) => U): IQuery<U>;

    /**
     * query will return set of object which has selected fields
     * using '@id' to select document id
     * .select('field1', 'field2', 'field3', ...)
     * @param fields
     */
    select(...fields: string[]): IQuery<T>;

    /**
     * query will return set of specified field value
     * using '@id' to select document id
     * @param isSelectSingleField must be true
     * @param field
     */
    select(isSelectSingleField: boolean, field: string): IQuery<T>;

    /**
     * .select({
     *     field1: 'newField1Name',
     *     field2: 'newField2Name'
     * })
     * using '@id' to select document id
     * @param fieldMapper
     */
    select(fieldMapper: object): IQuery<T>;

    /**
     * limit query results
     * @param count
     */
    limit(count: number): IQuery<T>;

    /**
     * return first query result
     */
    first(): Promise<T>;

    /**
     * filter query by one or many conditions
     * .where({
     *    // equivalent to field = value
     *    field: value,
     *    // equivalent to field &gt; value
     *    'field>': value,
     *    // equivalent to field = value
     *    'field==': value,
     *    // equivalent to field = value
     *    'field===': value,
     *    // equivalent to field != value
     *    'field<>': value,
     *    // equivalent to field != value
     *    'field!=': value,
     *    // equivalent to field != value
     *    'field!==': value,
     *    // equivalent to field startsWith value
     *    'field^=': value
     *    // equivalent to field IN arrayOfValue
     *    field: arrayOfValue,
     *
     *    or: [
     *        condition1,
     *        condition2
     *    ]
     * })
     * @param conditions
     */
    where(...conditions: object[]): IQuery<T>;

    /**
     * order result set by specified fields
     * .orderBy({
     *     field1: 'asc',
     *     field2: 'desc'
     * })
     */
    orderBy(fields: object): IQuery<T>;

    /**
     * start query and return promise of result set
     * @param options
     */
    get(options?: IQueryOption): Promise<T[]>;

    /**
     * return next result set for pagination
     */
    next(options?: IQueryOption): Promise<T[]>;

    /**
     * modify or create multiple documents by their ids. queryable object must be collection
     * .set({
     *     id1: data1,
     *     id2: data2
     * });
     *
     * modify documents which is satisfied query condition
     * .set(data, true);
     *
     * @param documentListOrData
     * @param applyToResultSet
     */
    set(documentListOrData: object, applyToResultSet?: boolean): IQuery<T>;

    /**
     * update multiple documents by their ids. queryable object must be collection
     * .set({
     *     id1: data1,
     *     id2: data2
     * });
     *
     * update documents which is satisfied query condition
     * .set(data, true);
     * @param documentListOrData
     * @param applyToResultSet
     */
    update(documentListOrData: object, applyToResultSet?: boolean): IQuery<T>;

    /**
     * return result of original data, no selector applied
     * @param options
     */
    data(options?: IQueryOption): Promise<T[]>;

    /**
     * remove all documents which is satisfied query condition
     */
    remove(): IQuery<T>;

    /**
     * create new query from collection. queryable must be firestore object
     */
    from<U>(collection: string): IQuery<U>;
}

interface IQueryCreator {
    <T>(queryable: T): IQuery<T>;

    <T>(firestore: any, collectionName: string): IQuery<T>;
}

declare let queryCreator: IQueryCreator;

export default queryCreator;
