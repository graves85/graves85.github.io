---
layout: content-layout
title: "로키·그라파나·프로메테우스란? 개념, 타 APM 비교, 설정과 실무 팁 📊"
date: 2026-10-23
categories: [TECH, INFRA]
tags: [Prometheus, 프로메테우스, Grafana, 그라파나, Loki, 로키, Alloy, PromQL, LogQL, Observability, APM, 모니터링, 인프라]
---

## 안녕하십니까! 😀

서비스가 커지면 "서버가 살아 있나"만으로는 장애를 설명하지 못합니다. 요청은 느린데 CPU는 한가한지, 에러 로그가 특정 파드에만 몰리는지, 그 순간 어떤 배포가 나갔는지를 숫자와 로그로 이어 붙여야 합니다.

그 역할을 나누어 맡기는 오픈소스 조합이 **프로메테우스(Prometheus)**, **로키(Loki)**, **그라파나(Grafana)** 입니다.

- 프로메테우스는 **지표(metrics)** 를 모으고 질의합니다.
- 로키는 **로그(logs)** 를 모으고 질의합니다.
- 그라파나는 둘을 **한 화면에서 보고, 알람을 띄우는 창**입니다.

오늘은 각 도구가 무엇인지, 데이터독·뉴렐릭 같은 APM과 어디가 다르고 어디가 약한지, 로컬에서 바로 띄우는 설정, 그리고 운영에서 꼭 지키는 팁과 함정까지 한 흐름으로 정리합니다.

예시는 **2026년 10월** 기준입니다.

| 구성 요소 | 이 글의 버전 |
|---|---|
| Prometheus | 3.15.1 (LTS 라인은 3.13.x) |
| Grafana OSS | 13.2.4 |
| Loki | 3.7.9 |
| Grafana Alloy | 1.21.2 |

로그 수집기 **Promtail은 2026년 3월 2일에 EOL** 되었습니다. 새 구성은 Alloy를 씁니다.

---

## 1. 한 세트로 보는 이유

관측(observability)에서 자주 말하는 신호는 지표, 로그, 트레이스입니다. 이 글의 세 도구는 그중 **지표와 로그, 그리고 그걸 보는 화면**을 담당합니다. 분산 추적은 Grafana Tempo, 장기 지표 저장은 Grafana Mimir나 Thanos, 프로파일은 Grafana Pyroscope가 같은 계열에서 이어 받습니다. 프로메테우스·로키·그라파나만으로 "APM 제품 하나"가 완성되지는 않습니다.

```
[애플리케이션]
   │  /metrics  (Prometheus가 주기적으로 당겨 감, Pull)
   │  stdout 로그 (Alloy가 읽어 Loki로 밀어 넣음, Push)
   ▼
┌─────────────┐     ┌─────────────┐
│ Prometheus  │     │    Loki     │
│  지표 TSDB   │     │  로그 저장소  │
└──────┬──────┘     └──────┬──────┘
       │   Grafana 데이터소스 │
       └─────────┬──────────┘
                 ▼
            ┌─────────┐
            │ Grafana │  대시보드 · Explore · 알람
            └─────────┘
```

둘의 데이터 모델이 닮아 있는 점이 이 조합의 핵심입니다. 프로메테우스 지표도, 로키 로그도 **이름 + 저카디널리티 라벨**로 스트림을 나눕니다. 그래서 그라파나에서 `namespace`, `app`, `pod` 같은 라벨로 지표 패널과 로그 패널을 나란히 걸 수 있습니다.

---

## 2. 프로메테우스란?

**Prometheus**는 SoundCloud에서 시작해 2016년 CNCF 프로젝트가 된 **지표 수집·저장·질의 시스템**입니다. 구글 내부 모니터링 Borgmon의 아이디어를 오픈소스로 가져온 계열입니다.

하는 일은 단순합니다. 설정에 적힌 대상(target)의 HTTP 엔드포인트, 보통 `/metrics`를 **주기적으로 긁어(scrape)** 시계열 데이터베이스에 넣고, **PromQL**로 질의합니다. 알람 규칙은 프로메테우스가 평가하고, 실제 발송·그룹핑·침묵은 별도 프로세스인 **Alertmanager**가 맡습니다.

### 📌 데이터 모델

한 샘플은 이렇게 생겼습니다.

```
http_requests_total{job="api", instance="10.0.0.8:8080", status="500"} 42
```

- `http_requests_total`은 지표 이름입니다.
- `{...}`는 라벨입니다. 같은 이름이라도 라벨 조합마다 **다른 시계열**입니다.
- 값은 그 시각의 숫자입니다. 카운터, 게이지, 히스토그램, 서머리로 종류가 나뉩니다.

카운터는 재시작 전까지만 증가합니다. "초당 요청 수"를 보려면 날값이 아니라 `rate()`로 **증가 속도**를 봐야 합니다.

### 📌 왜 Pull인가

프로메테우스가 대상을 찾아가므로, "이 잡이 지금 몇 개나 떠 있고 어디서 실패했는지"가 타깃 목록으로 남습니다. `up == 0` 한 줄이 "프로세스가 메트릭을 못 주고 있다"는 신호가 됩니다.

쿠버네티스에서는 파드, 서비스, 엔드포인트를 **서비스 디스커버리**로 자동 등록합니다. 서버가 늘어도 프로메테우스 설정을 손으로 고칠 필요가 없습니다.

짧은 수명의 배치 잡처럼 Pull이 어려운 경우에만 Pushgateway를 검토합니다. 상시 서비스를 Pushgateway에 밀어 넣는 패턴은 스테일 메트릭이 남기 쉬워 권하지 않습니다.

### 📌 저장과 한계

기본 저장소는 노드 로컬 TSDB입니다. 단일 바이너리로 시작하기 좋지만, **수년 치 고해상도 지표를 한 장에 영구 보관하는 데이터베이스는 아닙니다.** 보관 기간을 넘기면 지워집니다. 장기 보관·글로벌 뷰·중복 제거가 필요하면 remote write로 **Grafana Mimir, Thanos, VictoriaMetrics** 같은 뒷단을 붙입니다.

프로메테우스 두 대를 같은 타깃에 긁게 하면 고가용 스크랩은 됩니다. 다만 두 대가 하나의 클러스터 TSDB를 나누어 갖는 구조는 아닙니다. 알람 중복은 Alertmanager의 클러스터 모드로 묶습니다.

Prometheus 3(2024년 11월 첫 릴리스, 이 글은 3.15 기준)에서 체감할 변화는 새 UI, 메트릭·라벨 이름의 UTF-8 허용, 원격 쓰기 2.0, 안정화된 agent 모드, OTLP 수신(`--web.enable-otlp-receiver`)입니다. 2.x에서 올리기 전에 [마이그레이션 가이드](https://prometheus.io/docs/prometheus/latest/migration/)의 PromQL·스크랩 프로토콜 변경을 보는 것이 안전합니다.

---

## 3. 그라파나란?

**Grafana**는 지표와 로그를 직접 저장하지 않습니다. **데이터소스를 붙여 패널로 그리고, 탐색하고, 알람을 거는 시각화·운영 화면**입니다. 2014년 Torkel Ödegaard가 시작했고, 지금은 Grafana Labs가 주도합니다.

프로메테우스와 로키에만 묶여 있지 않습니다. 같은 조직 안에서 CloudWatch, BigQuery, Elasticsearch, Tempo, PostgreSQL을 데이터소스로 나란히 둘 수 있습니다. "그림 그리는 도구"로만 보면 역할이 작아 보입니다. 실무에서 그라파나가 맡는 일은 네 가지입니다.

| 기능 | 하는 일 |
|---|---|
| **Dashboard** | PromQL·LogQL 결과를 시계열, 게이지, 테이블, 로그 패널로 고정 |
| **Explore** | 저장하지 않고 지표·로그를 즉석에서 좁혀 가는 장애 조사 화면 |
| **Alerting** | 쿼리 조건을 폴더·연락 지점(Slack, 메일, Pager 등)과 연결. 프로메테우스 룰과 병행 가능 |
| **Provisioning** | 데이터소스·대시보드·알람을 YAML/JSON으로 코드화. UI에서만 만든 화면은 인스턴스가 바뀌면 사라지기 쉽습니다 |

조직(Org), 폴더, 권한으로 팀 화면을 나눕니다. OSS에도 사용자·팀 권한은 있고, SAML·세밀한 RBAC·엔터프라이즈 플러그인은 Grafana Enterprise 쪽에 있습니다. 배포 이미지는 OSS(`grafana/grafana`)와 Enterprise가 다릅니다. 이 글의 예시는 OSS입니다.

그라파나 알람과 프로메테우스 룰 + Alertmanager를 동시에 같은 증상에 걸어 두면 알람이 두 번 옵니다. **증상 알람의 소유 주체**를 한쪽으로 정하는 편이 낫습니다. 인프라 골든 시그널은 프로메테우스 룰, 대시보드에 가까운 비즈니스 지표는 그라파나 알람처럼 나누는 팀이 많습니다.

---

## 4. 로키란?

**Grafana Loki**는 Grafana Labs가 만든 **로그 집계 시스템**입니다. 설계 문장 한 줄로 요약하면 "프로메테우스처럼, 다만 로그용"입니다.

Elasticsearch가 로그의 **본문 단어까지 인덱싱**하는 것과 달리, 로키는 **라벨만 인덱스**하고 본문은 압축된 청크(chunk)로 오브젝트 스토리지에 넣습니다. 그래서 같은 로그 양에서 디스크·비용이 훨씬 작은 대신, 라벨 없이 `{app=~".+"}`처럼 넓은 스트림을 본문 검색하면 청크를 많이 읽습니다. 로키는 "아무 단어나 즉시 검색하는 로그 창고"가 아니라 **라벨로 먼저 좁히고, 그다음 줄을 거르는** 시스템입니다.

질의 언어는 **LogQL**입니다.

```logql
{namespace="prod", app="checkout"} |= "timeout" | json | line_format "{{.msg}}"
```

앞의 `{...}`가 스트림 선택(인덱스), `|=`와 `| json`이 청크를 읽고 거르는 단계입니다.

### 📌 구성 요소

바이너리는 하나이고, `-target`으로 어떤 역할을 띄울지 고릅니다.

| 구성 요소 | 하는 일 |
|---|---|
| **Distributor** | 들어온 로그의 라벨을 검증하고 인게스터로 나눔 |
| **Ingester** | 메모리에 쌓았다가 청크로 플러시. WAL로 재시작을 견딤 |
| **Querier / Query Frontend** | LogQL을 실행하고, 큰 질의는 시간 단위로 쪼개 병렬화 |
| **Compactor** | 인덱스 파일을 합치고 보관 기간이 지난 데이터를 삭제. **클러스터당 하나**만 동작해야 함 |
| **Ruler** | LogQL 기반 알람·레코딩 룰 |

배포 모드는 셋으로 나뉘었지만, 지금은 선택이 좁아졌습니다.

| 모드 | 언제 쓰나 |
|---|---|
| **Monolithic** (`-target=all`) | 학습·작은 운영. 공식 문서 기준으로는 대략 하루 20GB 수준까지. 공유 오브젝트 스토리지와 복제 계수로 HA 구성도 가능 |
| **Simple Scalable** (read/write/backend) | 예전 헬름 차트의 기본값. **Loki 4.0에서 제거 예정**이므로 신규 구축의 종착점으로 두지 않습니다 |
| **Microservices** | 수집과 질의를 컴포넌트별로 따로 늘려야 하는 대규모 |

인덱스 포맷은 **TSDB(schema v13)** 가 현재 권장입니다. BoltDB 인덱스는 구세대입니다. 스키마는 과거 구간을 덮어쓰지 않고, `schema_config`에 **새 기간을 추가**하는 방식으로 바꿉니다.

수집은 Alloy가 파일·저널·쿠버네티스 파드 로그·OTLP를 읽어 `POST /loki/api/v1/push`로 보냅니다. 애플리케이션이 로키 SDK를 직접 품기보다, **stdout으로 찍고 에이전트가 가져가게** 두는 편이 배포와 맞습니다.

멀티테넌시는 `X-Scope-OrgID` 헤더로 나뉩니다. 로컬 예제의 `auth_enabled: false`는 이 구분을 끄는 설정입니다. 여러 팀이 한 클러스터를 쓰면 켜고, 테넌트마다 수집 한도를 나눕니다.

---

## 5. 다른 APM과 비교하면

데이터독, 뉴렐릭, 다이나트레이스, 엘라스틱 APM은 **에이전트를 붙이면 서비스 맵, 분산 추적, 코드 구간, 에러 그룹, 인프라, 로그가 한 제품 안에서** 이어집니다. 사용량은 호스트·수집 GB·유저 시트 같은 **과금 단위**로 돌아옵니다.

프로메테우스·로키·그라파나는 그 제품의 오픈소스 대체재라기보다 **관측 신호를 직접 조립하는 부품**입니다. 트레이스까지 제품 수준으로 맞추려면 OpenTelemetry SDK/Collector, Tempo, 그리고 지표와 로그의 exemplar·trace id 연결이 더 필요합니다.

### 📌 잘 맞는 지점

- **과금 단위가 인프라와 운영 시간**입니다. 로그를 라벨 중심으로 설계하면, 전문 인덱싱 로그 플랫폼보다 저장 비용을 크게 줄이는 경우가 많습니다.
- 지표 생태계가 넓습니다. 노드, 블랙박스, MySQL, JMX, kube-state-metrics처럼 **exporter**가 이미 있는 컴포넌트는 코드를 거의 안 고치고 붙입니다.
- PromQL과 LogQL, OTLP는 특정 회사 SaaS 밖으로 옮길 수 있습니다. 화면은 그라파나에 묶이지만, 지표·로그 저장 형식 자체가 한 벤더 전용 바이너리는 아닙니다.
- 라벨이 같아 **지표 이상 → 같은 라벨의 로그**로 내려가는 조사가 자연스럽습니다.

### 📌 약한 지점

- **설치형 APM의 자동 계측**만큼 기본 제공물이 많지 않습니다. 서비스 맵, 느린 메서드, 배포 마커, 인시던트 워크플로, RUM은 따로 만들거나 옆 도구를 붙입니다.
- 로그 **전문 검색**은 엘라스틱서치·상용 로그 제품보다 불리합니다. 라벨을 잘못 고르면 쿼리가 느리고, 반대로 유니크한 값(유저 ID, 주문 번호)을 라벨로 올리면 인덱스가 터집니다. 그런 값은 **로그 본문이나 구조화 메타데이터**에 둡니다.
- 운영 책임이 남습니다. 카디널리티, 디스크, 업그레이드, 컴팩터, 스크랩 타임아웃을 사람이 봐야 합니다. SaaS APM이 대신 지켜 주던 자리입니다.
- 그라파나 대시보드는 강력하지만, "장애가 나면 원인 서비스가 자동으로 접힌다"는 경험은 상용 APM이 아직 앞섭니다.

### 📌 선택 기준

| 상황 | 이쪽을 먼저 검토 |
|---|---|
| 쿠버네티스 인프라 지표·골든 시그널이 본업이고, 팀을 운영할 사람이 있다 | Prometheus + Grafana. 장기 보관이 필요해지면 Mimir/Thanos |
| 로그 양이 큰데 검색은 `서비스 + 레벨 + 몇 개 키`면 된다 | Loki + Alloy |
| 주문 번호·전문 텍스트를 수시로 전역 검색해야 한다 | 검색 인덱스가 있는 로그 플랫폼, 또는 로키와 역할을 분리 |
| 트레이스·코드 레벨 APM을 제품처럼 바로 쓰고, 운영 인력이 적다 | 상용 APM 또는 Grafana Cloud처럼 운영이 포함된 경로 |
| 둘 다 필요하다 | 지표·로그는 이 스택, 트레이스는 OTel + Tempo(또는 상용 APM이 트레이스만) |

한 문장으로 줄이면, **증상의 숫자와 그 순간의 로그를 라벨로 맞춰 보고 싶을 때** 이 조합이 강합니다. 코드 구간까지 자동으로 집어 주는 턴키 APM을 기대하면 트레이스·프로파일 도구를 더 붙여야 합니다.

---

## 6. 설정 — 로컬에서 세 개를 한 번에

아래는 학습용 Docker Compose입니다. 인증이 없고 로그가 로컬 파일시스템에 쌓입니다. **이 파일 그대로를 운영 서버에 올리지 않습니다.** 이미지 태그는 위 표와 같습니다.

디렉터리 예시는 이렇습니다.

```
observability/
├── docker-compose.yml
├── prometheus/
│   ├── prometheus.yml
│   └── rules.yml
├── loki/
│   └── local-config.yaml
├── alloy/
│   └── config.alloy
└── grafana/
    └── provisioning/
        └── datasources/
            └── datasources.yaml
```

### 6.1 Prometheus

`prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["prometheus:9090"]

  - job_name: grafana
    static_configs:
      - targets: ["grafana:3000"]
```

`prometheus/rules.yml`

```yaml
groups:
  - name: availability
    rules:
      - alert: TargetDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }} 스크랩이 실패하고 있습니다"
          description: "{{ $labels.instance }} 가 2분 이상 up == 0 입니다."
```

`up`은 프로메테우스가 스크랩 성공 여부를 스스로 만드는 지표입니다. 애플리케이션 코드에 없습니다.

### 6.2 Loki

공식 로컬 예시를 단일 컨테이너 볼륨 경로에 맞춘 것입니다. 인덱스와 청크가 한 디스크에 있습니다.

`loki/local-config.yaml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory
  replication_factor: 1
  path_prefix: /loki

schema_config:
  configs:
    - from: 2024-04-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  filesystem:
    directory: /loki/chunks
```

운영에서는 `filesystem` 대신 S3·GCS·Azure Blob 같은 오브젝트 스토리지를 쓰고, 인스턴스를 둘 이상 띄울 때는 링(memberlist 등)과 복제 계수를 맞춥니다. 파일시스템을 여러 복제본이 동시에 쓰면 안 됩니다.

### 6.3 Alloy

도커 컨테이너 stdout을 읽어 로키로 보냅니다. 컨테이너 이름의 맨 앞 `/`는 라벨에서 제거합니다.

`alloy/config.alloy`

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
}

loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.containers.output
  forward_to = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

쿠버네티스에서는 소켓 대신 `loki.source.kubernetes` 또는 파드 로그 파일 + `discovery.kubernetes`를 데몬셋으로 띄웁니다. 예전에 Promtail을 쓰고 있다면 Alloy의 `alloy convert --source-format=promtail`로 설정을 옮긴 뒤, 알람에 쓰던 Promtail 자체 메트릭 이름이 바뀌지 않았는지 확인합니다.

### 6.4 Grafana 데이터소스

`grafana/provisioning/datasources/datasources.yaml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

UI에서 클릭으로 추가해도 동작은 같습니다. 다만 컨테이너를 새로 만들면 UI 설정은 볼륨에 없을 때 사라집니다. 데이터소스와 공용 대시보드는 프로비저닝 또는 대시보드 JSON으로 저장소에 둡니다.

### 6.5 Compose

`docker-compose.yml`

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.15.1
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=15d
      - --web.enable-lifecycle
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/rules.yml:/etc/prometheus/rules.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  loki:
    image: grafana/loki:3.7.9
    command: ["-config.file=/etc/loki/local-config.yaml"]
    volumes:
      - ./loki/local-config.yaml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    ports:
      - "3100:3100"

  alloy:
    image: grafana/alloy:v1.21.2
    command:
      - run
      - --server.http.listen-addr=0.0.0.0:12345
      - --storage.path=/var/lib/alloy/data
      - /etc/alloy/config.alloy
    volumes:
      - ./alloy/config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - alloy-data:/var/lib/alloy/data
    ports:
      - "12345:12345"
    depends_on:
      - loki

  grafana:
    image: grafana/grafana:13.2.4
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
      - loki

volumes:
  prometheus-data:
  loki-data:
  alloy-data:
  grafana-data:
```

```bash
docker compose up -d
```

확인 순서는 다음과 같습니다.

1. [http://localhost:9090/targets](http://localhost:9090/targets) 에서 `prometheus`, `grafana` 잡이 UP인지 봅니다.
2. [http://localhost:9090/graph](http://localhost:9090/graph) 에서 `up`을 실행합니다.
3. [http://localhost:3000](http://localhost:3000) 에 `admin` / `admin`으로 들어가 **Explore → Loki**에서 `{container=~".+"}`를 실행합니다. Alloy가 자기 자신과 옆 컨테이너 로그를 보내고 있어야 줄이 보입니다.
4. Alloy UI는 [http://localhost:12345](http://localhost:12345) 입니다. 컴포넌트가 healthy인지, 로키 push 오류가 있는지 여기서 먼저 봅니다.

애플리케이션 지표를 붙일 때는 프로세스에 `/metrics`를 열고, `scrape_configs`에 잡만 추가하면 됩니다. 클라이언트 라이브러리(Java/Go/Python 등)가 `http_requests_total`, `http_request_duration_seconds_bucket` 같은 관례적인 이름을 만들어 줍니다. 이름을 팀마다 다르게 짓기보다 **OpenTelemetry 시맨틱 컨벤션이나 기존 RED 이름**을 재사용하는 편이 대시보드를 공유하기 좋습니다.

쿠버네티스 운영 설치의 출발점은 지표 쪽 `kube-prometheus-stack` 헬름 차트, 로그 쪽 Loki 헬름 차트와 Alloy 데몬셋입니다. Loki 헬름 차트 유지 주체는 2026년 3월부터 Grafana 커뮤니티 차트 저장소로 옮겨졌습니다. 차트 기본값이 Simple Scalable이면 Loki 4.0 이전에 **마이크로서비스 또는 HA 모놀리식**으로 갈 계획을 같이 적어둡니다.

---

## 7. 쓰면서 바로 적용하는 팁

### 1) 라벨은 적게, 값의 가짓수는 더 적게

라벨 한 조합이 시계열 하나, 로그 스트림 하나입니다. `pod`, `namespace`, `app`, `status`처럼 **가짓수가 제한된 값**만 라벨로 올립니다. `user_id`, `order_id`, `trace_id`, 정규화되지 않은 URL 전체는 라벨이 되면 프로메테우스 메모리와 로키 인덱스를 같이 키웁니다.

카디널리티가 의심되면 프로메테우스의 **Status → TSDB**(`/api/v1/status/tsdb`)에서 시리즈가 많은 지표와 라벨을 봅니다. 스크랩 단계에서 `metric_relabel_configs`로 버리거나 묶는 것이, 쌓인 뒤를 지우는 것보다 쉽습니다.

### 2) 대시보드는 RED와 USE로 시작

서비스마다 패널을 새로 발명하지 않아도 됩니다.

- **RED**: 요청 처리 서비스의 Rate(초당 요청), Errors(실패 비율), Duration(지연 히스토그램).
- **USE**: 자원의 Utilization, Saturation, Errors. CPU·메모리·디스크·커넥션 풀.

히스토그램 분위수는 버킷에 `rate`를 씌운 뒤 계산합니다.

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{job="api"}[5m])
  )
)
```

`[5m]`은 스크랩 간격(여기서 15초)보다 충분히 길어야 합니다. 범위 안에 샘플이 두 개 미만이면 `rate`는 비어 있습니다. 대시보드 범위 벡터는 **스크랩 간격의 4배 이상**, 흔히 5분을 출발점으로 둡니다.

에러 비율은 상태 라벨이 있을 때의 전형적인 형태입니다.

```promql
sum(rate(http_requests_total{job="api", status=~"5.."}[5m]))
/
sum(rate(http_requests_total{job="api"}[5m]))
```

분모가 0인 구간은 패널에서 비어 보일 수 있습니다. 트래픽이 없는 밤중에 에러율이 1이 되는 알람은 `sum(rate(...[5m])) > 0` 조건을 같이 겁니다.

### 3) 로그 쿼리도 라벨이 먼저

```logql
{namespace="prod", app="checkout"} |= "ERROR" != "health"
```

`|=`는 그 문자열을 포함하는 줄, `!=`는 제외입니다. JSON으로 찍고 있다면 `| json` 뒤에 `level="error"`처럼 필드로 거릅니다. 가능하면 애플리케이션이 **한 줄에 JSON 하나**를 출력하게 합니다. 여러 줄 스택트레이스는 단계(stage) 설정이 없으면 서로 다른 로그로 쪼개집니다.

로그에서 지표를 만들 수도 있습니다.

```logql
sum by (container) (rate({job="docker"} |= "ERROR" [5m]))
```

이미 프로메테우스 히스토그램으로 재고 있는 수치를 로그 집계로 다시 만들지 않습니다. 로그 지표 쿼리는 청크를 읽으므로, **로그에만 있는 사건**(특정 예외 문자열, 외부 연동 실패 문구)에 한정하는 편이 맞습니다.

### 4) 알람은 증상, 기간은 `for`

CPU가 잠깐 80%인 것과, 5분째 에러 비율이 5%인 것은 다릅니다. 사용자에게 가까운 증상(에러 비율, 지연, `up`, 큐 적체)에 걸고, 원인(특정 GC 카운트)은 대시보드 조사 패널로 둡니다.

`for: 2m`처럼 **지속 시간**이 없으면 스크랩 한 번의 공백에도 알람이 납니다. 반대로 `for`가 너무 길면 짧은 장애를 놓칩니다. 심각도는 라벨로 나누고, Alertmanager 라우트에서 치명만 전화·페이저로 보냅니다.

룰을 추가한 뒤에는 프로메테우스 **Alerts** 화면에서 pending → firing이 기대대로인지, 그라파나 연락 지점의 **Test**가 실제 채널에 도착하는지를 배포 전에 봅니다.

### 5) 자주 쓰는 쿼리는 레코딩 룰로

여러 대시보드가 같은 `histogram_quantile(...)`를 매번 계산하면 프로메테우스 CPU가 쿼리에 쓰입니다. 결과가 안정된 집계는 recording rule로 미리 시계열을 만들어 둡니다. 룰 이름에는 `job:http_requests:rate5m`처럼 **라벨:지표:연산** 형태의 콜론 규칙을 쓰면 나중에 찾기 쉽습니다.

### 6) 화면에서 지표와 로그를 같은 라벨로 묶기

그라파나 대시보드 상단에 `namespace`, `app` 변수를 만들고 지표 패널과 로그 패널이 **같은 변수**를 보게 합니다. 로그 한 줄에 trace id가 있다면 파생 필드(derived field)로 Tempo 링크를 걸 수 있습니다. 트레이스 백엔드를 아직 안 붙였더라도, **로그에 trace id를 남기는 습관**은 나중에 연결할 때 그대로 쓰입니다. trace id 자체를 로키·프로메테우스 라벨로 올리지는 않습니다.

### 7) 보관 기간을 지표와 로그에서 따로 정하기

이 글의 프로메테우스는 `--storage.tsdb.retention.time=15d`입니다. 장애 조사가 보통 최근 며칠이면 그것으로 충분하고, 월간 추세가 필요하면 해상도를 낮춘 remote write가 맞습니다. 모든 지표를 1년 동안 15초 해상도로 남기면 디스크와 메모리 모두 비쌉니다.

로키 보관은 컴팩터의 retention과 테넌트 `limits_config`가 같이 맞아야 실제로 지워집니다. 용량 알람 없이 "일단 무기한"으로 두면 인게스터·오브젝트 스토리지 한도에서 수집이 거절됩니다.

---

## 8. 운영에서 먼저 걸리는 주의점

**카디널리티가 장애 그 자체입니다.** 새 라벨을 넣기 전에 "값의 가짓수가 최대 몇 개인가"를 적습니다. 배포 한 번에 시리즈가 몇 배가 되면 프로메테우스는 OOM, 로키는 스트림 한도(`max_streams`) 거절로 나타납니다. 한도를 무조건 풀기보다 라벨을 줄입니다.

**로컬 예제의 인증 꺼짐, admin/admin, 도커 소켓 마운트는 학습용입니다.** Alloy가 도커 소켓을 읽으면 호스트 컨테이너 로그 전체에 접근합니다. 운영 소켓 마운트는 권한과 네트워크 정책을 따로 설계합니다. 로키 push API도 기본 예제에는 인증이 없습니다. 네트워크가 닿는 곳에 그대로 열면 아무나 로그를 넣을 수 있습니다.

**시계가 어긋나면 샘플이 거절되거나 순서가 뒤틀립니다.** NTP를 맞추고, 로키의 너무 오래된 샘플 거절 한도(`reject_old_samples`)를 앱 지연과 비교해 봅니다. 컨테이너 로그가 한꺼번에 재처리될 때 out-of-order가 보이면 Alloy·로키 쪽 허용 창을 문서 기준으로 조정합니다.

**스크랩 대상까지의 네트워크 경로를 방화벽이 막으면 `up == 0`입니다.** Pull 모델이라 프로메테우스 → 파드 방향이 열려 있어야 합니다. 서비스 모니터를 만들었는데 타깃이 0개면 라벨 셀렉터와 네임스페이스 범위를 먼저 봅니다.

**Pushgateway에 상시 서비스를 넣지 않습니다.** 프로세스가 죽어도 마지막으로 민 값이 남아 "정상"으로 보일 수 있습니다.

**컴팩터는 한 개만 돌립니다.** 모놀리식을 여러 복제본으로 늘릴 때 컴팩터·룰러까지 전부 중복 실행되지 않는지 타깃 플래그를 확인합니다.

**스키마와 주요 버전은 릴리스 노트를 보고 올립니다.** `schema_config`의 기존 `from` 날짜를 과거로 고쳐 이미 쌓인 인덱스를 재해석하게 만들지 않습니다. 프로메테우스 2에서 3으로 갈 때는 스크랩 Content-Type 처리, PromQL 범위의 경계, 제거된 플래그가 동작 차이로 나타납니다.

**로그 본문에 비밀이 들어가지 않게 합니다.** 인증 헤더, 토큰, 주민번호, 카드 번호는 지표 라벨은 물론 로그 줄에도 남기 쉽습니다. 앱에서 마스킹하고, 실수로 들어온 패턴은 Alloy의 `loki.process` 단계에서 버립니다. 수집 한도를 높이는 일보다 우선입니다.

**그라파나 OSS 라이선스는 AGPLv3**입니다. 이미지를 수정해 네트워크 서비스로 제공할 계획이면 배포 전에 라이선스 의무를 확인합니다. 공식 이미지를 그대로 띄워 대시보드만 쓰는 경우와, 코드를 고쳐 재배포하는 경우는 다릅니다.

**Simple Scalable 모드와 Promtail은 신규 설계의 기본값에서 빼 둡니다.** 지금 차트나 구 문서가 그 둘을 가리키더라도, 도착점은 Alloy와 Loki 4.0 이후에도 남는 배포 모드입니다.

---

## 마치며

프로메테우스는 숫자를 당겨 모아 PromQL로 "얼마나, 얼마나 자주"를 답하고, 로키는 같은 라벨 체계로 "그때 무슨 줄이 남았나"를 답하고, 그라파나는 둘을 한 시간축 위에 올립니다.

APM 제품 하나를 켜는 일과는 다릅니다. 라벨을 아껴 두고, 알람은 증상에 걸며, 로그 검색은 항상 스트림 선택으로 시작한다는 세 가지만 지켜도 이 스택이 비용 대비로 오래 갑니다. 트레이스까지 이으려면 다음 단계로 OpenTelemetry와 Tempo를 같은 라벨·trace id 위에 올리면 됩니다.

로컬 Compose로 `up`과 `{container=~".+"}`가 보이는 것까지 확인한 뒤, 운영 클러스터의 헬름 값과 보관 기간을 잡는 순서를 권합니다. 🚀
