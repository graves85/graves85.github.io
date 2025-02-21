fetch('/data/posts.json')
.then(response => response.json())
.then(posts => {
    const mainContent = document.getElementById('list-content');

    posts.forEach(post => {
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

        // main 태그 내에 새로 생성한 div 추가
        mainContent.appendChild(postDiv);
    });
})
.catch(error => console.error('Error loading posts:', error));