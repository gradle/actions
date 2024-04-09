# Deprecation upgrade guide

As these actions evolve, certain inputs, behaviour and usages are deprecated for removal. 
Deprecated functionality will be fully supported during the current major release, and will be
removed in the next major release. 
Users will receive a deprecation warning when they rely on deprecated functionality, 
prompting them to update their workflows.

## Deprecated in v3.x

### Using the action to execute Gradle via the `arguments` parameter is deprecated

The core functionality of the `setup-gradle` (and `gradle-build-action`) actions is to configure your
Gradle environment for GitHub Actions. Once the action has run, any subsequent Gradle executions will
benefit from caching, reporting and other features of the action.

Using the `arguments` parameter to execute Gradle directly is not necessary to benefit from this action.
This input is deprecated, and will be removed in the `v4` major release of the action.

To convert your workflows, replace any steps using the `arguments` parameter with 2 steps: one to `setup-gradle` and another that runs your Gradle build.

For example, if your workflow looks like this:

```
steps:
- name: Assemble the project
  uses: gradle/actions/setup-gradle@v3
  with:
    arguments: 'assemble'

 - name: Run the tests
   uses: gradle/actions/setup-gradle@v3
   with:
     arguments: 'test'
```

Then replace this with a single call to `setup-gradle` together with separate `run` steps to execute your build.

```
- name: Setup Gradle
  uses: gradle/actions/setup-gradle@v3

- name: Assemble the project
  run: ./gradlew assemble

- name: Run the tests
  run: ./gradlew test
```

Using the action in this way gives you more control over how Gradle is executed, while still giving you
all of the benefits of the `setup-gradle` action.

The `arguments` parameter is scheduled to be removed in `setup-gradle@v4`.

Note: if you are using the `gradle-build-action`, [see here](#the-gradle-build-action-has-been-replaced-by-the-setup-gradle-action) for more details on how to migrate.

### The `gradle-build-action` has been replaced by the `setup-gradle` action

The `gradle-build-action` action has evolved, so that the core functionality is now to configure the
Gradle environment for GitHub Actions. For clarity and consistency with other action (eg `setup-java`, `setup-node`), the `gradle-build-action` has been replaced by the `setup-gradle` action.

As of `v3.x`, the `setup-gradle` and `gradle-build-action` actions are functionally identical,
and are released with the same versions.

To convert your workflows, simply replace:
```
   uses: gradle/gradle-build-action@v3
```
with
```
    uses: gradle/actions/setup-gradle@v3
```

### The `build-scan-terms-of-service` input parameters have been renamed

With recent releases of the `com.gradle.develocity` plugin, key input parameters have been renamed.
- `build-scan-terms-of-service-url` is now `build-scan-terms-of-use-url`
- `build-scan-terms-of-service-agree` is now `build-scan-terms-of-use-agree`

The standard URL for the terms of use has also changed to https://gradle.com/help/legal-terms-of-use

To convert your workflows, change:
```
    build-scan-publish: true
    build-scan-terms-of-service-url: "https://gradle.com/terms-of-service"
    build-scan-terms-of-service-agree: "yes"
```

to this:
```
    build-scan-publish: true
    build-scan-terms-of-use-url: "https://gradle.com/help/legal-terms-of-use"
    build-scan-terms-of-use-agree: "yes"
```
These deprecated build-scan parameters are scheduled to be removed in `setup-gradle@v4` and `dependency-submission@v4`.
