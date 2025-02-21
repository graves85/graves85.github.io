fetch('/data/posts.json')
.then(response => response.json())
.then(posts => {
    const frontendContainer = document.getElementById('frontend-list-content');
    const backendContainer = document.getElementById('backend-list-content');
    const dbContainer = document.getElementById('db-list-content');
    const infraContainer = document.getElementById('infra-list-content');
    const newsContainer = document.getElementById('news-list-content');

    posts.forEach(post => {
        // 날짜를 기준으로 내림차순 정렬
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 각 포스트를 담을 div 요소 생성
        const postDiv = document.createElement('div');
        postDiv.classList.add('post-item'); // 'post-item' 클래스 추가

        // 포스트 제목 추가
        const postTitle = document.createElement('h4');
        postTitle.textContent = post.title;
        postDiv.appendChild(postTitle);

        // 포스트 날짜 추가
        const postDate = document.createElement('p');
        postDate.textContent = post.date;
        postDiv.appendChild(postDate);

        // Based on type, append to the respective container
        if (post.type === 'frontend') {
            frontendContainer.appendChild(postDiv);
        } else if (post.type === 'backend') {
            backendContainer.appendChild(postDiv);
        } else if (post.type === 'db') {
            dbContainer.appendChild(postDiv);
        } else if (post.type === 'infra') {
            infraContainer.appendChild(postDiv);
        } else if (post.type === 'news') {
            newsContainer.appendChild(postDiv);
        }
    });
})
.catch(error => console.error('Error loading posts:', error));