# clay-driver-sequelize@1.0.1

Clay driver for Sequelize

+ Functions
  + [create(args)](#clay-driver-sequelize-function-create)
+ [SequelizeDriver](clay-driver-sequelize-classes) Class
  + [new SequelizeDriver()](#clay-driver-sequelize-classes-sequelize-driver-constructor)
  + [driver.connect(args)](#clay-driver-sequelize-classes-sequelize-driver-connect)
  + [driver.create(namepath, data)](#clay-driver-sequelize-classes-sequelize-driver-create)
  + [driver.read(namepath)](#clay-driver-sequelize-classes-sequelize-driver-read)
  + [driver.update(namepath, data)](#clay-driver-sequelize-classes-sequelize-driver-update)
  + [driver.delete(namepath)](#clay-driver-sequelize-classes-sequelize-driver-delete)
  + [driver.assertConnected()](#clay-driver-sequelize-classes-sequelize-driver-assertConnected)
  + [driver.defineRecord(sequelize)](#clay-driver-sequelize-classes-sequelize-driver-defineRecord)
  + [driver.recordAttributes(namepath, data)](#clay-driver-sequelize-classes-sequelize-driver-recordAttributes)

## Functions

<a class='md-heading-link' name="clay-driver-sequelize-function-create" ></a>

### create(args) -> `SequelizeDriver`

Create driver instance

| Param | Type | Description |
| ----- | --- | -------- |
| args | * |  |



<a class='md-heading-link' name="clay-driver-sequelize-classes"></a>

## SequelizeDriver Class

Abstract driver


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-constructor" ></a>

### new SequelizeDriver()

Constructor of SequelizeDriver class



<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-connect" ></a>

### driver.connect(args) -> `Promise`

Connect driver

| Param | Type | Description |
| ----- | --- | -------- |
| args | * | Sequelize arguments |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-create" ></a>

### driver.create(namepath, data) -> `Promise`

Create data with namepath

| Param | Type | Description |
| ----- | --- | -------- |
| namepath | string | Namepath string |
| data | Object | Resource data to create |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-read" ></a>

### driver.read(namepath) -> `Promise`

Read data with namepath

| Param | Type | Description |
| ----- | --- | -------- |
| namepath | string | Namepath string |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-update" ></a>

### driver.update(namepath, data) -> `Promise`

Update data with namepath

| Param | Type | Description |
| ----- | --- | -------- |
| namepath | string | Namepath string |
| data | Object | Resource data to create |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-delete" ></a>

### driver.delete(namepath) -> `Promise`

Delete data with namepath

| Param | Type | Description |
| ----- | --- | -------- |
| namepath | string | Namepath string |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-assertConnected" ></a>

### driver.assertConnected()

Assert that driver connected

<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-defineRecord" ></a>

### driver.defineRecord(sequelize) -> `Object`

Define a record model

| Param | Type | Description |
| ----- | --- | -------- |
| sequelize | Sequelize | A Sequelize instance. |


<a class='md-heading-link' name="clay-driver-sequelize-classes-sequelize-driver-recordAttributes" ></a>

### driver.recordAttributes(namepath, data) -> `Object`

Create attributes of a record instance

| Param | Type | Description |
| ----- | --- | -------- |
| namepath | string |  |
| data | Object |  |




