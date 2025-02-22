fetch('/data/posts.json')
.then(response => response.json())
.then(posts => {
    const devContainer = document.getElementById('dev-list-content');
    const dbContainer = document.getElementById('db-list-content');
    const infraContainer = document.getElementById('infra-list-content');
    const newsContainer = document.getElementById('news-list-content');
    const recentsContainer = document.getElementById('recents-list-content');

    // 날짜를 기준으로 내림차순 정렬
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    posts.forEach(post => {

        // 각 포스트를 담을 div 요소 생성
        const postDiv = document.createElement('div');
        postDiv.classList.add('post-item'); // 'post-item' 클래스 추가

        // 페이지를 이동할 수 있는 a 요소 생성
        const postA = document.createElement('a');
        postA.href = post.url;
        postDiv.appendChild(postA);

        // 포스트 제목 추가
        const postTitle = document.createElement('h4');
        postTitle.textContent = post.title;
        postA.appendChild(postTitle);

        // 포스트 날짜 추가
        const postDate = document.createElement('p');
        postDate.textContent = post.date;
        postA.appendChild(postDate);

        // Based on type, append to the respective container
        if (post.type === 'dev' && devContainer != null) {
            devContainer.appendChild(postDiv);
        } else if (post.type === 'db' && dbContainer != null) {
            dbContainer.appendChild(postDiv);
        } else if (post.type === 'infra' && infraContainer != null) {
            infraContainer.appendChild(postDiv);
        } else if (post.type === 'news' && newsContainer != null) {
            newsContainer.appendChild(postDiv);
        } else if (recentsContainer != null) {
            recentsContainer.appendChild(postDiv);
        }
    });
})
.catch(error => console.error('Error loading posts:', error));

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".copy-btn").forEach((button) => {
        button.addEventListener("click", function () {
            const codeBlock = this.previousElementSibling.innerText;
            navigator.clipboard.writeText(codeBlock).then(() => {
                this.textContent = "✅";
                setTimeout(() => (this.textContent = "📋"), 1500);
            }).catch(err => console.error("복사 실패:", err));
        });
    });
});