---
layout: default
title: Home
permalink: /
---

<section class="hero">
  <p class="hero__eyebrow">Graves85 Tech Blog</p>
  <h1 class="hero__title">프로그래밍, DB, 인프라를<br>경험 중심으로 정리하는 블로그</h1>
  <p class="hero__desc">
    Java · Spring · Docker · Kubernetes · SQL 튜닝 등
    실무에서 겪은 내용과 학습 기록을 공유합니다.
  </p>
  <div class="hero__actions">
    <a class="btn btn--primary" href="/categories/DEV/">DEV 글 보기</a>
    <a class="btn btn--ghost" href="https://github.com/graves85/graves85.github.io" target="_blank" rel="noopener noreferrer">GitHub</a>
  </div>
</section>

<section class="section">
  <div class="section-header">
    <h2 class="section-title">카테고리</h2>
    <p class="section-desc">관심 분야별로 글을 모아봤습니다.</p>
  </div>
  <div class="category-grid">
    {% assign dev_count = site.categories.DEV | size %}
    {% assign db_count = site.categories.DB | size %}
    {% assign infra_count = site.categories.INFRA | size %}
    <a class="category-card" href="/categories/DEV/">
      <span class="category-card__label">DEV</span>
      <span class="category-card__count">{{ dev_count }} posts</span>
      <span class="category-card__desc">Java, Kotlin, 클린코드, 디자인패턴</span>
    </a>
    <a class="category-card" href="/categories/DB/">
      <span class="category-card__label">DB</span>
      <span class="category-card__count">{{ db_count }} posts</span>
      <span class="category-card__desc">Oracle, MySQL, SQL 튜닝</span>
    </a>
    <a class="category-card" href="/categories/INFRA/">
      <span class="category-card__label">INFRA</span>
      <span class="category-card__count">{{ infra_count }} posts</span>
      <span class="category-card__desc">Docker, Kubernetes, 인프라 구축</span>
    </a>
  </div>
</section>

<section class="section">
  <div class="section-header">
    <h2 class="section-title">최근 글</h2>
    <p class="section-desc">가장 최근에 발행한 기술 글입니다.</p>
  </div>
  <div class="post-grid">
    {% assign shown = 0 %}
    {% for post in site.posts %}
      {% unless post.categories contains 'NEWS' %}
        {% include post-card.html post=post %}
        {% assign shown = shown | plus: 1 %}
        {% if shown >= 6 %}{% break %}{% endif %}
      {% endunless %}
    {% endfor %}
  </div>
</section>

<section class="profile-card">
  <img class="profile-card__image" src="https://i.imgur.com/fS28Jqb.jpg" alt="Graves85 프로필">
  <div class="profile-card__body">
    <h2 class="profile-card__name">Graves85</h2>
    <p class="profile-card__role">Java 기반 웹 애플리케이션 개발자</p>
    <ul class="profile-card__list">
      <li><strong>관심 분야</strong> DDD, TDD, 클린 아키텍처</li>
      <li><strong>취미</strong> 사이드 프로젝트, 게임</li>
    </ul>
    <a class="btn btn--ghost" href="https://github.com/graves85/graves85.github.io">GitHub에서 소통하기</a>
  </div>
</section>
