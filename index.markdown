---
layout: default
title: Home
permalink: /
---

<section class="hero">
  <p class="hero__eyebrow">Graves85 Tech Blog</p>
  <h1 class="hero__title">프로그래밍, DB, 인프라를<br>경험 중심으로 정리하는 블로그</h1>
  <p class="hero__desc">
    Java · Kotlin · Spring · Docker · Kubernetes · Oracle SQL 등
    실무에서 겪은 내용과 개발 기록을 공유합니다.
  </p>
  <div class="hero__actions">
    <a class="btn btn--primary" href="/categories/TECH/">TECH 글 보기</a>
    <a class="btn btn--ghost" href="/categories/LOG/">LOG 글 보기</a>
  </div>
</section>

<section class="section">
  <div class="section-header">
    <h2 class="section-title">카테고리</h2>
    <p class="section-desc">관심 분야별로 글을 모아봤습니다.</p>
  </div>
  <div class="category-grid category-grid--2cols">
    {% assign tech_count = site.categories.TECH | size %}
    {% assign log_count = site.categories.LOG | size %}
    <a class="category-card category-card--tech" href="/categories/TECH/">
      <div class="category-card__head">
        <span class="category-card__label">TECH</span>
        <span class="category-card__count">{{ tech_count }} posts</span>
      </div>
      <span class="category-card__desc">Java, Kotlin, 클린코드, 디자인패턴, Git, DB(Oracle), 인프라(Docker, K8s)</span>
    </a>
    <a class="category-card category-card--log" href="/categories/LOG/">
      <div class="category-card__head">
        <span class="category-card__label">LOG</span>
        <span class="category-card__count">{{ log_count }} posts</span>
      </div>
      <span class="category-card__desc">GitHub 블로그 개설 및 운영기, 회고와 생각 기록</span>
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
