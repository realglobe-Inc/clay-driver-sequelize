# clay-driver-sequelize@3.0.9

Clay driver for Sequelize

+ Functions
  + [create(args)](#clay-driver-sequelize-function-create)
+ [`SequelizeDriver`](#clay-driver-sequelize-class) Class
  + [new SequelizeDriver(database, username, password, options)](#clay-driver-sequelize-class-sequelize-driver-constructor)
  + [driver.one(resourceName, id)](#clay-driver-sequelize-class-sequelize-driver-one)
  + [driver.list(resourceName, condition)](#clay-driver-sequelize-class-sequelize-driver-list)
  + [driver.create(resourceName, attributes)](#clay-driver-sequelize-class-sequelize-driver-create)
  + [driver.update(resourceName, id, attributes)](#clay-driver-sequelize-class-sequelize-driver-update)
  + [driver.destroy(resourceName, id)](#clay-driver-sequelize-class-sequelize-driver-destroy)
  + [driver.drop(resourceName)](#clay-driver-sequelize-class-sequelize-driver-drop)
  + [driver.resources()](#clay-driver-sequelize-class-sequelize-driver-resources)

## Functions

<a class='md-heading-link' name="clay-driver-sequelize-function-create" ></a>

### create(args) -> `SequelizeDriver`

Create driver instance

| Param | Type | Description |
| ----- | --- | -------- |
| args | * |  |



<a class='md-heading-link' name="clay-driver-sequelize-class"></a>

## `SequelizeDriver` Class

Abstract driver

**Extends**:

+ `Driver`



<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-constructor" ></a>

### new SequelizeDriver(database, username, password, options)

Constructor of SequelizeDriver class

| Param | Type | Description |
| ----- | --- | -------- |
| database | string | Name of database |
| username | string | Database username |
| password | string | Database password |
| options | Object | Optional settings |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-one" ></a>

### driver.one(resourceName, id) -> `Promise.<ClayEntity>`

Get single entity from resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| id | ClayId | Resource id |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-list" ></a>

### driver.list(resourceName, condition) -> `Promise.<ClayCollection>`

List entities from resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| condition | ListCondition | List condition query |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-create" ></a>

### driver.create(resourceName, attributes) -> `Promise.<ClayEntity>`

Create a new entity with resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| attributes | Object | Resource attributes to create |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-update" ></a>

### driver.update(resourceName, id, attributes) -> `Promise.<ClayEntity>`

Update an existing entity in resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| id | ClayId | Resource id |
| attributes | Object | Resource attributes to update |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-destroy" ></a>

### driver.destroy(resourceName, id) -> `Promise.<number>`

Delete a entity resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| id | ClayId | Resource id |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-drop" ></a>

### driver.drop(resourceName) -> `Promise.<boolean>`

Drop resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |


<a class='md-heading-link' name="clay-driver-sequelize-class-sequelize-driver-resources" ></a>

### driver.resources() -> `Promise.<Resource>`

List resources



