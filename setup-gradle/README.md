# The `setup-gradle` action

This action is a simple wrapper around `gradle/gradle-build-action`, removing the deprecated `arguments` parameter (and thus removing the ability to _execute_ gradle).
The intention is to eventually deprecate `gradle-build-action` with this being the replacement.

### Example usage

```yaml
name: Build

on:
  workflow_dispatch:
  push:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Gradle
      uses: gradle/actions/setup-gradle@v0
    - name: Build with Gradle
      run: ./gradlew build
```

See the [`gradle-build-action` documentation](https://github.com/gradle/gradle-build-action/blob/main/README.md) for a full description of this action.
