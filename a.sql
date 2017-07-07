SELECT
  *
FROM
  (
    SELECT
      `Entity`.`id`, `Entity`.`cid`, `Entity`.`createdAt`, `Entity`.`updatedAt`, `Entity`.`ResourceId`
    FROM `Entities` AS `Entity`
  )
  AS `Entity`
  LEFT OUTER JOIN
    `EntityAttributes` AS `EntityAttributes`
  ON `Entity`.`id` = `EntityAttributes`.`EntityId`
WHERE `Entity`.`ResourceId` = 1