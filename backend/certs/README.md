# TLS certificates

Place the **Aiven service CA certificate** here as `aiven-ca.pem`.

1. Aiven Console → your MySQL service → **Overview** tab.
2. Under *Connection information*, download the **CA Certificate** (`ca.pem`).
3. Save it in this folder as `aiven-ca.pem` (or set `MYSQL_SSL_CA` to wherever
   you put it).

This certificate is what lets the backend verify Aiven's server identity over
TLS (certificate chain + hostname). Do **not** commit real certificates or keys
to source control, and never disable verification as a workaround.
