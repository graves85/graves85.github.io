---
layout: content-layout
title: "취약점을 대비할 수 있는 시큐어 코딩(Secure Coding) 완벽 가이드! (멱등성, CSRF, XSS, 금융 보안) 🛡️"
date: 2026-08-24
categories: [TECH, 개발]
tags: [시큐어코딩, 보안, SecureCoding, 멱등성, CSRF, XSS, SQLInjection, 금융보안, 핀테크, 백엔드]
---

## 안녕하십니까! 😀

디지털 금융, 이커머스 등 웹/앱 서비스가 고도화될수록 시스템의 성능 못지않게 중요한 것이 바로 **애플리케이션 보안(Security)**입니다.

단 한 번의 파라미터 변조나 멱등성 누락으로 인해 **중복 송금/결제 사고**가 발생하거나, **SQL Injection / XSS** 취약점으로 고객의 개인정보가 유출되면 기업에 막대한 금전적·법적 피해를 초래하게 됩니다.

오늘은 개발자가 실무에서 반드시 구현해야 할 **핵심 시큐어 코딩 기법(멱등성, CSRF, 파라미터 변조 방지, SQLi, XSS)**과 실전 코드 예시, 그리고 **금융/뱅킹 서비스에서 특히 엄격하게 다뤄야 하는 보안 요소**까지 체계적으로 정리해보겠습니다! 🚀

---

## 1. 멱등성(Idempotency) 보장과 중복 요청 방어

### 📌 멱등성이란?
**멱등성(Idempotency)**은 동일한 연산을 여러 번 수행하더라도 시스템의 결과 상태가 달라지지 않는 성질을 의미합니다. (예: `GET`, `PUT`, `DELETE`는 기본적으로 멱등해야 함)

결제, 송금, 포인트 차감과 같은 `POST` 요청 환경에서 사용자의 따닥(더블 클릭)이나 네트워크 재시도로 인해 동일 요청이 2번 전달되었을 때 중복 결제가 발생하지 않도록 **멱등성 키(Idempotency Key)** 메커니즘을 적용해야 합니다.

### 💡 멱등성 처리 흐름
```
[클라이언트 요청] ──(Header: X-Idempotency-Key: UUID)──► [API 서버]
                                                             │
                                                             ▼
                                                    [Redis 키 조회]
                                              ┌──────────────┴──────────────┐
                                              ▼                             ▼
                                      [Key 존재 (처리 중/완료)]        [Key 없음 (최초 요청)]
                                              │                             │
                                              ▼                             ▼
                                    캐시된 기존 응답 즉시 반환       Redis에 Key 저장 (SETNX + TTL)
                                    (중복 결제 방지)                 비즈니스 로직 실행 후 응답 캐싱
```

### 💻 실전 코드 예시 (Spring Boot + Redis)

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class IdempotencyValidator {

    private final StringRedisTemplate redisTemplate;

    public void validateAndLock(String idempotencyKey, long timeoutSeconds) {
        String key = "idempotency:" + idempotencyKey;

        // SET key value NX EX timeout (원자적 락 획득)
        Boolean success = redisTemplate.opsForValue()
                .setIfAbsent(key, "PROCESSING", Duration.ofSeconds(timeoutSeconds));

        if (Boolean.FALSE.equals(success)) {
            // 이미 처리 중이거나 완료된 요청 -> 중복 요청 예외 발생
            throw new DuplicateRequestException("이미 처리 중이거나 완료된 요청입니다. Key: " + idempotencyKey);
        }
    }

    public void complete(String idempotencyKey, String responseJson, long ttlMinutes) {
        String key = "idempotency:" + idempotencyKey;
        // 최종 성공 응답을 캐싱해두어 동일 키 재요청 시 DB 부하 없이 이전 응답 반환
        redisTemplate.opsForValue().set(key, responseJson, Duration.ofMinutes(ttlMinutes));
    }
}
```

---

## 2. CSRF (Cross-Site Request Forgery) 토큰 적용

### 📌 CSRF 공격이란?
로그인된 피해자의 브라우저 쿠키/세션 권한을 악용하여, 공격자가 심어둔 악성 웹페이지에서 피해자 모르게 원치 않는 요청(비밀번호 변경, 송금 등)을 서버로 전송하게 만드는 공격입니다.

### 💡 방어 기법: Synchronizer Token Pattern (CSRF Token)
서버는 사용자의 세션마다 고유하고 예측 불가능한 암호화 난수(CSRF 토큰)를 발급하고, 상태를 변경하는 요청(`POST`, `PUT`, `DELETE`)마다 폼(Form) 파라미터나 헤더(`X-CSRF-TOKEN`)에 담아 검증합니다.

```java
// Spring Security 6.x CSRF 설정 예시
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf
                // 쿠키 기반 CSRF 토큰 저장소 (Single Page Application 연동 시 용이)
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            );

        return http.build();
    }
}
```

> 💡 **참고**: REST API에서 쿠키 기반 세션을 쓰지 않고 `Authorization: Bearer <JWT>` 헤더 방식을 사용하며 브라우저가 자동으로 자격증명을 실어 보내지 않는 구조라면 CSRF 위험은 대폭 줄어듭니다. 단, Refresh Token을 `HttpOnly Cookie`로 관리하는 경우엔 여전히 `SameSite=Strict` 쿠키 속성 적용이 필수입니다.

---

## 3. 파라미터 변조(Parameter Tampering) 체크

### 📌 파라미터 변조 공격이란?
공격자가 웹 프록시 도구(Burp Suite 등)나 브라우저 개발자 도구를 이용해 클라이언트에서 전송되는 가격(`price`), 수량(`amount`), 결제 대상 ID(`userId`) 값을 임의로 변조하여 전송하는 공격입니다.

```
[공격 시나리오]
정상 결제: { "itemId": 101, "price": 50000 }
공격자 변조: { "itemId": 101, "price": 100 }  <-- 100원에 5만원짜리 물건 결제 시도!
```

### 💻 방어 원칙 및 코드 예시

1. **클라이언트가 보낸 가격/할인율/권한 정보를 절대 신뢰하지 않는다.**
2. 클라이언트는 오직 식별자(`itemId`, `orderId`, `quantity`)만 전달하고, **실제 금액은 서버 DB에서 직접 조회하여 계산**한다.
3. 요청자 ID와 리소스 소유자 ID의 일치 여부(**IDOR: Insecure Direct Object References 방어**)를 서버에서 검증한다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final ItemRepository itemRepository;
    private final OrderRepository orderRepository;

    @Transactional
    public OrderResponse createOrder(Long currentUserId, OrderCreateRequest request) {
        // ❌ Bad: request.getPrice()를 그대로 신뢰하여 결제 진행 (금액 변조 취약)

        // ⭕ Good: DB에서 실제 상품의 최신 가격을 조회하여 서버에서 금액 계산
        Item item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new NotFoundException("상품을 찾을 수 없습니다."));

        // 유효 수량 및 판매 상태 검증
        if (request.getQuantity() <= 0 || request.getQuantity() > 100) {
            throw new InvalidParameterException("잘못된 주문 수량입니다.");
        }

        BigDecimal actualTotalPrice = item.getPrice().multiply(BigDecimal.valueOf(request.getQuantity()));

        // 주문 생성 및 저장
        Order order = Order.builder()
                .userId(currentUserId) // 인증 토큰에서 추출한 신뢰할 수 있는 사용자 ID
                .item(item)
                .totalAmount(actualTotalPrice)
                .status(OrderStatus.PENDING)
                .build();

        return OrderResponse.from(orderRepository.save(order));
    }
}
```

---

## 4. SQL 인젝션(SQL Injection) 완벽 방어

### 📌 SQL Injection이란?
사용자 입력값이 SQL 쿼리 문법의 일부로 해석되어, 공격자가 DB를 임의로 조작하거나 기밀 데이터를 탈취하는 가장 대표적인 웹 취약점입니다.

### 💻 방어 기법: PreparedStatement (바인딩 변수 사용)

```java
// ❌ Bad: 문자열 결합(String Concatenation) 방식 (SQL Injection 취약)
String query = "SELECT * FROM users WHERE email = '" + userInputEmail + "' AND password = '" + userPassword + "'";
Statement stmt = connection.createStatement();
ResultSet rs = stmt.executeQuery(query);
// 공격자가 email에 "' OR '1'='1" 입력 시 전체 사용자 인증 우회!

// ⭕ Good 1: JDBC PreparedStatement (파라미터 바인딩 (?))
String safeSql = "SELECT * FROM users WHERE email = ? AND password = ?";
PreparedStatement pstmt = connection.prepareStatement(safeSql);
pstmt.setString(1, userInputEmail);
pstmt.setString(2, userPassword);
ResultSet rs = pstmt.executeQuery();

// ⭕ Good 2: JPA / JPQL Named Parameter 바인딩
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    // 바인딩 파라미터를 사용하므로 안전함
    @Query("SELECT u FROM User u WHERE u.email = :email")
    Optional<User> findByEmail(@Param("email") String email);
}

// ⭕ Good 3: MyBatis XML Mapper (#{} 사용)
// ⚠️ ${email} -> 취약 (문자열 그대로 치환)
// ⭕ #{email} -> 안전 (PreparedStatement 파라미터 매핑)
```

---

## 5. XSS (Cross-Site Scripting) 필터 적용 및 방어

### 📌 XSS 공격이란?
게시판 본문, 댓글, 프로필 이름 등에 악성 자바스크립트 코드(`<script>alert(document.cookie)</script>`)를 삽입하여 다른 사용자의 브라우저에서 실행되게 함으로써 세션 탈취, 피싱 등을 유발하는 공격입니다.

### 💡 방어 기법
1. **HTML Entity 치환 (Escape/Sanitize)**: `<`, `>`, `&`, `"`, `'` 등의 특수문자를 `&lt;`, `&gt;`로 이스케이프 처리
2. **Lucy XSS Filter / OWASP Java HTML Sanitizer 적용**
3. **HTTP Header 보안 설정**: `Content-Security-Policy (CSP)`, `X-XSS-Protection`

```java
// Spring Boot XSS 방어용 ObjectMapper 직렬화 설정 (JSON 응답 이스케이프)
@Configuration
public class XssConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        SimpleModule xssModule = new SimpleModule();
        xssModule.addSerializer(String.class, new JsonSerializer<String>() {
            @Override
            public void serialize(String value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                if (value != null) {
                    // HTML 특수문자 이스케이프 (Apache Commons Text 활용)
                    gen.writeString(StringEscapeUtils.escapeHtml4(value));
                }
            }
        });
        mapper.registerModule(xssModule);
        return mapper;
    }
}
```

---

## 6. 그 외 추가적인 필수 시큐어 코딩 수칙

1. **민감 정보 마스킹 및 로깅 금지 (Log Forgery 방어)**
   - 비밀번호, 주민등록번호, 계좌번호, 카드 CVC, JWT 토큰 등은 **로그 파일(Logback/Log4j)에 절대 평문으로 남기지 않습니다.**
   - 로그 개행 문자(`\r`, `\n`) 주입을 통한 로그 위조 방지 필터링 적용
2. **비밀번호 단방향 암호화 (Salt + Slow Hash)**
   - 단순 SHA-256 대신 **BCrypt**, **Argon2**, **PBKDF2**처럼 Adaptive Key Derivation 함수를 사용하여 레인보우 테이블 공격 및 무차별 대입(Brute-force) 방어
3. **안전한 난수 생성기 사용**
   - 인증번호, 임시 토큰, 암호화 키 생성 시 예측 가능한 `java.util.Random` 대신 **`java.security.SecureRandom`** 사용
4. **CORS (Cross-Origin Resource Sharing) 엄격 설정**
   - `Access-Control-Allow-Origin: *` 와 `Allow-Credentials: true`를 함께 사용하지 않고, 신뢰할 수 있는 도메인만 명시적 화이트리스트로 관리

---

## 7. 뱅킹/금융 앱에서 특히 더욱 중요하게 다뤄야 할 보안 요소! 🏦

금융 서비스는 사용자의 실제 **자산(돈)**을 다루기 때문에 일반 웹 서비스보다 훨씬 보수적이고 엄격한 다중 보안 방어선이 요구됩니다.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   금융 시스템 다계층 보안 아키텍처 (Defense-in-Depth)   │
├───────────────────┬────────────────────────────────────────────────────┤
│ 트래픽/진입 계층  │ WAF, FDS(이상거래탐지), mTLS(상호인증), 앱 위변조 방지 │
│ 통신/전송 계층    │ E2E 종단간 암호화, SSL Pinning, Replay Attack 방지 │
│ 비즈니스/데이터   │ 2-Phase 트랜잭션 검증, 원장 정합성, 감사 로그(Audit)  │
│ DB/인프라 계층    │ 컬럼 단위 AES-256 암호화, 망분리, HSM(하드웨어보안모듈)│
└───────────────────┴────────────────────────────────────────────────────┘
```

### 🔑 1) E2E 종단간 암호화 (End-to-End Encryption)
- 계좌 비밀번호, 보안카드/OTP 번호, 간편 비밀번호(PIN 6자리)는 입력 가상 키패드 단계부터 백엔드 보안 모듈(HSM)까지 **구간 전체를 공개키 기반으로 암호화**하여 중간자 공격(MITM)이나 메모리 덤프로부터 탈취를 원천 차단합니다.

### 🔑 2) SSL Pinning (인증서 핀닝)
- 악의적인 프록시 툴(Charles, Fiddler)을 이용한 패킷 감청을 방지하기 위해, 모바일 앱 내부에 서버의 인증서 공개키(Public Key Hash)를 하드코딩하여 신뢰할 수 있는 정품 서버와만 TLS 핸드셰이크를 맺도록 강제합니다.

### 🔑 3) FDS (Fraud Detection System, 이상금융거래 탐지 시스템)
- 평소와 다른 비정상적인 거래 패턴(예: 새벽 시간대 급격한 거액 송금, 1분 만에 서울과 해외에서 동시 로그인, 루팅/탈옥 단말기 접근 등)을 AI/룰 엔진으로 실시간 탐지하여 **추가 인증(ARS/생체인증)을 요구하거나 거래를 즉시 차단**합니다.

### 🔑 4) 트랜잭션 원장 불일치 방지 및 감사 로그(Audit Trail)
- **더블 엔트리(복식부기) 원칙**: 출금 계좌와 입금 계좌의 차변/대변 합계가 항상 0이 되는지 트랜잭션 단위로 검증
- **변경 불가능한 감사 로그(Immutable Audit Log)**: 모든 금전 거래, 관리자 접근 이력은 수정/삭제가 불가능한 Write-Once Storage나 WORM 스토리지에 별도 보관하여 사후 추적성을 확보합니다.

### 🔑 5) 세션 타임아웃 & 다중 기기 중복 로그인 차단
- 미사용 시 10분 자동 로그아웃, 1인 1단말 정책(Device Binding)을 통해 계정 탈취 위험을 최소화합니다.

---

## 8. 마치며 & 요약 정리

보안은 "기능 구현이 끝난 뒤 덧붙이는 옵션"이 아니라, **"설계와 구현 첫 단계부터 코드 레벨에 내재화되어야 하는 기본 원칙"**입니다.

- **멱등성**: 멱등키 + Redis 원자적 락으로 중복 결제/송금 완벽 차단
- **CSRF & XSS**: CSRF 토큰 검증, HTML Entity 이스케이프 및 CSP 적용
- **파라미터 변조**: 클라이언트 입력값을 신뢰하지 않고 DB 기반 실서버 재검증
- **SQLi**: 무조건 PreparedStatement / ORM Named Parameter 바인딩
- **금융 특화 보안**: E2E 가상키패드 암호화, SSL Pinning, FDS, 복식부기 정합성 및 감사 로그

안전하고 견고한 시큐어 코딩 습관을 통해 사용자에게 신뢰받는 서비스를 만들어가시길 바랍니다!

긴 글 읽어주셔서 감사합니다. 궁금한 점이나 의견은 언제든 편하게 댓글 남겨주세요! 😊
