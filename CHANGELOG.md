# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Notes]

The comments above about changelogs and semantic versioning start about 2022-09-05. I'm trying to be better about
documenting things now, but earlier versions of Ratchet don't necessarily fully follow semantic versioning.

Alpha releases are exactly what they sound like - places where I am trying out new things that aren't ready for prime
time, but I need published to see how they interact with the rest of my software ecosystem. If you use an alpha
package without knowing why it is alpha you'll get exactly what you deserve.

## [Unreleased]

- Currently, expanding Epsilon to take advantage of CDK for my most common deployments

## [4.0.x] - In Process

- Added ability to serve HTTPS from the sample local server
- Switched to AWS SDK version 3

## [3.3.x] - 2023-01-02

### Added

- DaemonHandler and associated classes to make it easy to expose Ratchet Daemons through your REST API

### Changed

- Changed the index files to move all deployment to its own barrel, so that if you don't use CDK you don't have to have it in your build

## [3.2.x] - 2022-12-12

### Changed

- Updated to newer library versions

## [3.1.x] - 2022-11-21

### Changed

- Updated to newer library versions
- (Backwards incompatible) Changed Local web token manipulator to be async to allow keys to be pulled from async source
- Refactored local web token manipulator to delegate all actual work to JwtRatchet
- New JwtRatchet correctly uses the exp field as seconds instead of MS (may log out old tokens, or push exp so far in the
  future that changing keys is advisable)
- Updated Commander to much newer version, breaking old wiring

## [2.1.x] - 2022-10-27

### Changed

- Updated to newer library versions
- Official release of CDK support for "Standard" Epsilon design

## [1.0.x] - 2022-08-24

### Added

- Support for trace id and level in structured logs

### Changed

- Switched to default to structured logging

## [0.13.x] - 2022-01-26

### Changed

- Updated AWS, switched to Github actions
- Above 0.13.10 added most basic support for ApiGatewayV2 (and Lambda Function Url) handling backwards compatibility

## [0.12.x] - 2022-01-16

### Changed

- Updated Apollo (GraphQL) to v3 which may be backwards incompatible

## [0.11.x] - 2021-11-01

### Changed

- Adding concept of inter-api events (Only useful when combining multiple related apis and decoupling)

## [0.10.x] - 2021-09-10

### Changed

- Deprecated Salt Mine library and moved all handling into Epsilon under "Background" handling
- Switched HTTP handling to a filter based model

## [0.9.x] - 2021-02-28

### Changed

- TBD

## [0.8.x] - 2021-02-26

### Changed

- Updated core libs
- Switched to Luxon from Moment to match Ratchet

## [0.7.x] - 2021-01-08

### Changed

- Updated core libs
- Added ContextUtil to get static access to the AWS context object
- Renamed apiGateway to http in config
- Add ability to log JWT parse errors at defined levels
- Added new endpoints to the sample server
- Added outbound model validation
- Added blocking on "null" literal string on query and path params
- Added request id as outbound header
- Added better (no longer crashes) handling when a null object returns from a handler

## [0.6.x] - 2020-11-04

### Changed

- Updated core libs
- Added richer error object and builder pattern for errors

## [0.5.x] - 2020-09-19

### Changed

- Updated core libs
- Moved to eslint and cleaned up

## [0.4.x] - 2020-07-08

### Changed

- Switched logging for GraphQL introspection calls on local-server down to silly level
- Updated to new version of libraries
- Switched to js-yaml instead of node-yaml
- Moved api-gateway package to http package to reflect that this also handles ALB endpoints

## [0.3.x] - 2020-04-30

### Changed

- Remapped CRON handler to be able to filter on more than just the incoming Event name. Given the new mapping,
  I'd recommend just setting up an "every minute" Cloudwatch event and using filters. Filters now allow
  running multiple Batch processors, eg Dev/QA/Prod
- Adding logging of request ID to output errors
- Added default error (to allow masking of 500 errors in prod and prevent information leakage)
- Allow optional access to the request context for handlers (esp for the request id, remaining time)

## [0.2.x] - 2020-02-13

### Changed

- TBD when I do some repo diving

## [0.1.x] - 2019-08-02

### Changed

- TBD when I do some repo diving

## [0.0.x] - 2018-07-13

### Changed

- TBD when I do some repo diving

### Added

- Initial releases
