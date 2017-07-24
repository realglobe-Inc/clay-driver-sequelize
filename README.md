clay-driver-sequelize
==========

<!---
This file is generated by ape-tmpl. Do not update manually.
--->

<!-- Badge Start -->
<a name="badges"></a>

[![Build Status][bd_travis_shield_url]][bd_travis_url]
[![npm Version][bd_npm_shield_url]][bd_npm_url]
[![JS Standard][bd_standard_shield_url]][bd_standard_url]

[bd_repo_url]: https://github.com/realglobe-Inc/clay-driver-sequelize
[bd_travis_url]: http://travis-ci.org/realglobe-Inc/clay-driver-sequelize
[bd_travis_shield_url]: http://img.shields.io/travis/realglobe-Inc/clay-driver-sequelize.svg?style=flat
[bd_travis_com_url]: http://travis-ci.com/realglobe-Inc/clay-driver-sequelize
[bd_travis_com_shield_url]: https://api.travis-ci.com/realglobe-Inc/clay-driver-sequelize.svg?token=
[bd_license_url]: https://github.com/realglobe-Inc/clay-driver-sequelize/blob/master/LICENSE
[bd_codeclimate_url]: http://codeclimate.com/github/realglobe-Inc/clay-driver-sequelize
[bd_codeclimate_shield_url]: http://img.shields.io/codeclimate/github/realglobe-Inc/clay-driver-sequelize.svg?style=flat
[bd_codeclimate_coverage_shield_url]: http://img.shields.io/codeclimate/coverage/github/realglobe-Inc/clay-driver-sequelize.svg?style=flat
[bd_gemnasium_url]: https://gemnasium.com/realglobe-Inc/clay-driver-sequelize
[bd_gemnasium_shield_url]: https://gemnasium.com/realglobe-Inc/clay-driver-sequelize.svg
[bd_npm_url]: http://www.npmjs.org/package/clay-driver-sequelize
[bd_npm_shield_url]: http://img.shields.io/npm/v/clay-driver-sequelize.svg?style=flat
[bd_standard_url]: http://standardjs.com/
[bd_standard_shield_url]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg

<!-- Badge End -->


<!-- Description Start -->
<a name="description"></a>

Clay driver for Sequelize

<!-- Description End -->


<!-- Overview Start -->
<a name="overview"></a>



<!-- Overview End -->


<!-- Sections Start -->
<a name="sections"></a>

<!-- Section from "doc/guides/01.Installation.md.hbs" Start -->

<a name="section-doc-guides-01-installation-md"></a>

Installation
-----

```bash
$ npm install clay-driver-sequelize --save
```


<!-- Section from "doc/guides/01.Installation.md.hbs" End -->

<!-- Section from "doc/guides/02.Usage.md.hbs" Start -->

<a name="section-doc-guides-02-usage-md"></a>

Usage
---------

```javascript
'use strict'

const { SequelizeDriver } = require('clay-driver-sequelize')

{
  const clayLump = require('clay-lump')
  let lump01 = clayLump({
    driver: new SequelizeDriver('my-app', 'user01', 'xxxxxx', {
      dialect: 'mysql'
    })
  })
  /* ... */
}

```


<!-- Section from "doc/guides/02.Usage.md.hbs" End -->

<!-- Section from "doc/guides/03.API.md.hbs" Start -->

<a name="section-doc-guides-03-a-p-i-md"></a>

API
---------

# clay-driver-sequelize@5.0.11

Clay driver for Sequelize

+ Functions
  + [create(args)](#clay-driver-sequelize-function-create)
+ [`SequelizeDriver`](#clay-driver-sequelize-class) Class
  + [new SequelizeDriver(database, username, password, options)](#clay-driver-sequelize-class-sequelize-driver-constructor)

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







<!-- Section from "doc/guides/03.API.md.hbs" End -->


<!-- Sections Start -->


<!-- LICENSE Start -->
<a name="license"></a>

License
-------
This software is released under the [Apache-2.0 License](https://github.com/realglobe-Inc/clay-driver-sequelize/blob/master/LICENSE).

<!-- LICENSE End -->


<!-- Links Start -->
<a name="links"></a>

Links
------

+ [ClayDB][clay_d_b_url]
+ [Realglobe, Inc.][realglobe,_inc__url]
+ [Sequelize][sequelize_url]

[clay_d_b_url]: https://github.com/realglobe-Inc/claydb
[realglobe,_inc__url]: http://realglobe.jp
[sequelize_url]: http://docs.sequelizejs.com/

<!-- Links End -->
