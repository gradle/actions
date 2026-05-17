# GitHub Actions for Gradle builds

A set of GitHub Actions that accelerate and simplify Gradle builds on GitHub — with smart caching, wrapper validation, job summaries, and optional supply-chain security via dependency graph submission.

> [!NOTE]
> ### ⚡️ Choice of caching providers in v6
> To provide the fastest possible build experience this action includes **Enhanced Caching** via `gradle-actions-caching`, an optimized provider powered by proprietary technology. This feature is **free for all public repositories** and is currently available as a **Free Preview** for private repositories. 
>
> **Prefer a 100% Open Source (MIT) path?**
> We also provide a **Basic Caching** provider as a thin wrapper over `actions/cache`. This provider is **free for all repositories** (public and private) and can be enabled at any time by setting `cache-provider: basic`.
>
> For a full breakdown of the components, usage tiers, and our **Safe Harbor** data privacy commitment, see our [Distribution & Licensing Guide](./DISTRIBUTION.md).

## Recommended usage — root meta-action

The simplest way to get started is with the root meta-action (`QueenFi703/actions`). It sets up Java and Gradle in a single step with sensible defaults.

```yaml
name: Build

on:
  push:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Java and Gradle
      uses: QueenFi703/actions@v1
    - name: Build with Gradle
      run: ./gradlew build
```

### Customising Java and Gradle

```yaml
    - name: Setup Java and Gradle
      uses: QueenFi703/actions@v1
      with:
        java-version: 21
        distribution: temurin
        gradle-version: '8.7'
        cache-read-only: false
```

### Enabling dependency graph submission

Set `enable-dependency-submission: true` to generate and submit a dependency graph for supply-chain security (requires `contents: write` permission):

```yaml
name: Dependency Submission

on:
  push:
    branches: [ 'main' ]

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Java and Gradle, submit dependency graph
      uses: QueenFi703/actions@v1
      with:
        enable-dependency-submission: true
```

## Advanced usage — sub-actions

For fine-grained control, use the sub-actions directly:

- **`QueenFi703/actions/setup-gradle@v1`** — Configure Gradle caching, wrapper validation, build scans, and more.
- **`QueenFi703/actions/dependency-submission@v1`** — Generate and submit a dependency graph independently.

### Example: `setup-gradle` sub-action

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: 17
    - name: Setup Gradle
      uses: gradle/actions/setup-gradle@v6
    - name: Build with Gradle
      run: ./gradlew build
```

See the [full setup-gradle documentation](docs/setup-gradle.md) for all available inputs and advanced usage scenarios.

### Example: `dependency-submission` sub-action

```yaml
name: Dependency Submission

on:
  push:
    branches: [ 'main' ]

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: 17
    - name: Generate and submit dependency graph
      uses: QueenFi703/actions/dependency-submission@v1
```

See the [full dependency-submission documentation](docs/dependency-submission.md) for more advanced usage scenarios.

## The `wrapper-validation` action

The `wrapper-validation` action validates the checksums of _all_ [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html) JAR files present in the repository and fails if any unknown Gradle Wrapper JAR files are found.

The action should be run in the root of the repository, as it will recursively search for any files named `gradle-wrapper.jar`.

Starting with v4 the `setup-gradle` action will [perform wrapper validation](docs/setup-gradle.md#gradle-wrapper-validation) on each execution.
If you are using `setup-gradle` in your workflows, it is unlikely that you will need to use the `wrapper-validation` action.

### Example workflow

```yaml
name: "Validate Gradle Wrapper"

on:
  push:
  pull_request:

jobs:
  validation:
    name: "Validation"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: QueenFi703/actions/wrapper-validation@v1
```

See the [full action documentation](docs/wrapper-validation.md) for more advanced usage scenarios.

## Credits

| Name | GitHub |
|---|---|
| Sophia Cole | [@QueenFi703](https://github.com/QueenFi703) |

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the full list.
