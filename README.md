## Description

- This is the 'JWT authentication' microservice, will be responsible for all the authentication stuff in whole cluster.

- We target stateless architecture.

## Note

1. We are not using 'master' branch.

2. Any new created branch please indicate its 'target' and 'based point' in the branch name explicitly.

3. We plan to use [ESLint](http://eslint.org/) to enforce code style:

    - Now extended code style from [Google](https://google.github.io/styleguide/javascriptguide.xml), and redefined the following rules:

        - Turn 'require-jsdoc' off.

    - Enable it by putting `lint` into `pre-commit` section in `package.json`, then will run the `eslint .` before anyone's any git commit try, if lint failed, then the commit would also fail, or you can run it manually by running `npm run lint`.

    - [ESLint configuration guide](http://eslint.org/docs/user-guide/configuring)

    - [ESLint rule list](http://eslint.org/docs/rules/)

## How to build this image, and then push to our private registry

  ```
  # Build your image.
  docker build \
    --no-cache=true \
    --pull=true \
    --compress=false \
    --rm=true \
    --force-rm=true \
    --build-arg PORTS_END=53547 \
    --tag auth-dev-leonard-1:0.0.1 \
    .

  # Tag your image.
  docker tag auth-dev-leonard-1:0.0.1 micro02.sgdev.vcube.com:65300/auth-dev-leonard-1:0.0.1

  # Login to the corresponding registry.
  docker login micro02.sgdev.vcube.com:65300

  # Push your image to the registry.
  docker push micro02.sgdev.vcube.com:65300/auth-dev-leonard-1:0.0.1
  ```

## Run this project at your localhost

  ```
  #
  ## -n to specify whether you need to run npm install.
  ## -w to specify the owner of this env.
  #
  source run.sh -n -w leonard
  ```

## Memo

- run `npm config set save-prefix='~'`

- **cluster.schedulingPolicy** can be set through the **NODE_CLUSTER_SCHED_POLICY** environment variable. Valid values are **rr** and **none**.


