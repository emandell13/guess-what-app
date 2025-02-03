# guess-what-app

## How to check and scale Heroku dynos

1. Check the status of your dynos:
    ```sh
    heroku ps
    ```

2. If no web dynos are running, scale up the web dynos:
    ```sh
    heroku ps:scale web=1
    ```

3. Restart your application to ensure changes take effect:
    ```sh
    heroku restart
    ```

## Troubleshooting Heroku Dyno Crashes

1. Check the logs to identify the error:
    ```sh
    heroku logs --tail
    ```

2. Ensure all dependencies are installed:
    ```sh
    npm install
    ```

3. Restart the dyno:
    ```sh
    heroku restart
    ```
