FROM postgres:15

# Install python3, pip, and compilation tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-psycopg2 \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Install Patroni and the etcd driver
RUN pip3 install --break-system-packages patroni[etcd3]

# Create patroni directory structure
RUN mkdir -p /etc/patroni /data/patroni && chown -R postgres:postgres /etc/patroni /data/patroni

USER postgres
CMD ["patroni", "/etc/patroni/patroni.yml"]
