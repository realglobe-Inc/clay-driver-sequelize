# clay-driver-sequelize@2.0.9

Clay driver for Sequelize

+ Functions
  + [create(args)](#clay-driver-sequelize-function-create)
+ [`SequelizeDriver`](#clay-driver-sequelize-classes) Class
  + [new SequelizeDriver()](#clay-driver-sequelize-classes-sequelize-driver-constructor)
  + [driver.one(resourceName, id)](#clay-driver-sequelize-classes-sequelize-driver-one)
  + [driver.list(resourceName, condition)](#clay-driver-sequelize-classes-sequelize-driver-list)
  + [driver.create(resourceName, attributes)](#clay-driver-sequelize-classes-sequelize-driver-create)
  + [driver.update(resourceName, id, attributes)](#clay-driver-sequelize-classes-sequelize-driver-update)
  + [driver.destroy(resourceName, id)](#clay-driver-sequelize-classes-sequelize-driver-destroy)
  + [driver.drop(resourceName)](#clay-driver-sequelize-classes-sequelize-driver-drop)
  + [driver.resources()](#clay-driver-sequelize-classes-sequelize-driver-resources)

## Functions

<a class='md-heading-link' name="clay-driver-sequelize-function-create" ></a>

### create(args) -> `SequelizeDriver`

Create driver instance

| Param | Type | Description |
| ----- | --- | -------- |
| args | * |  |



<a class='md-heading-link' name="clay-driver-sequelize-classes"></a>

## `SequelizeDriver` Class

Abstract driver

**Extends**:

+ `Driver`



<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-constructor" ></a>

### new SequelizeDriver()

Constructor of SequelizeDriver class



<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-one" ></a>

### driver.one(resourceName, id) -> `Promise.<ClayEntity>`

Get single entity from resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| id | ClayId | Resource id |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-list" ></a>

### driver.list(resourceName, condition) -> `Promise.<ClayCollection>`

List entities from resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| condition | ListCondition | List condition query |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-create" ></a>

### driver.create(resourceName, attributes) -> `Promise.<ClayEntity>`

Create a new entity with resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| attributes | Object | Resource attributes to create |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-update" ></a>

### driver.update(resourceName, id, attributes) -> `Promise.<ClayEntity>`

Update an existing entity in resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| id | ClayId | Resource id |
| attributes | Object | Resource attributes to update |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-destroy" ></a>

### driver.destroy(resourceName, id) -> `Promise.<number>`

Delete a entity resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |
| id | ClayId | Resource id |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-drop" ></a>

### driver.drop(resourceName) -> `Promise.<boolean>`

Drop resource

| Param | Type | Description |
| ----- | --- | -------- |
| resourceName | string | Name of resource |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-resources" ></a>

### driver.resources() -> `Promise.<Resource>`

List resources



