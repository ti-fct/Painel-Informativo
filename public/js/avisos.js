document.addEventListener('DOMContentLoaded', () => {
    // Seletores dos elementos principais
    const avisosContainer = document.getElementById('avisos-grid');
    const modal = document.getElementById('aviso-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('aviso-form');
    const addBtn = document.getElementById('add-aviso-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');

    let avisosData = [];

    // --- FUNÇÕES DE UI ---
    const showToast = (message, isError = false) => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.backgroundColor = isError ? 'var(--color-danger)' : 'var(--color-success)';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const openModalForCreate = () => {
        form.reset();
        document.getElementById('aviso_index').value = '';
        modalTitle.textContent = 'Adicionar Novo Aviso';
        modal.style.display = 'flex';
    };

    const openModalForEdit = (index) => {
        const aviso = avisosData[index];
        form.reset();
        modalTitle.textContent = 'Editar Aviso';
        document.getElementById('aviso_index').value = index;
        document.getElementById('titulo').value = aviso.titulo;
        document.getElementById('descricao').value = aviso.descricao;
        document.getElementById('data_inicio').value = aviso.data_inicio.replace(' ', 'T');
        document.getElementById('data_fim').value = aviso.data_fim.replace(' ', 'T');
        document.getElementById('link').value = aviso.link || '';
        modal.style.display = 'flex';
    };

    const closeModal = () => modal.style.display = 'none';

    const renderAvisos = () => {
        avisosContainer.innerHTML = '';
        if (!avisosData || avisosData.length === 0) {
            avisosContainer.innerHTML = '<p>Nenhum aviso cadastrado. Clique em "Adicionar Novo Aviso" para começar.</p>';
            return;
        }

        avisosData.forEach((aviso, index) => {
            const card = document.createElement('div');
            card.className = 'aviso-card';
            // Usando classes de ação que serão procuradas pelo event listener
            card.innerHTML = `
                <img class="aviso-card-image" src="${aviso.url_imagem || 'https://via.placeholder.com/600x300.png?text=Sem+Imagem'}" alt="Imagem do aviso" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x300.png?text=Imagem+Inv%C3%A1lida'">
                <div class="aviso-card-content">
                    <h3>${aviso.titulo}</h3>
                    <div class="aviso-card-dates">
                        <strong>De:</strong> ${new Date(aviso.data_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}<br>
                        <strong>Até:</strong> ${new Date(aviso.data_fim).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <p>${aviso.descricao}</p>
                    ${aviso.link ? `<a href="${aviso.link}" target="_blank" class="aviso-card-link">Acessar link →</a>` : ''}
                </div>
                <div class="aviso-card-actions">
                    <button class="btn btn-secondary edit-btn" data-index="${index}">Editar</button>
                    <button class="btn btn-danger delete-btn" data-index="${index}">Excluir</button>
                </div>
            `;
            avisosContainer.appendChild(card);
        });
    };

    // --- LÓGICA DE API ---
    const fetchAvisos = async () => {
        try {
            const response = await fetch('/api/avisos');
            if (!response.ok) throw new Error(`Falha ao carregar avisos: ${response.statusText}`);
            avisosData = await response.json();
            renderAvisos();
        } catch (error) {
            showToast(error.message, true);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const index = formData.get('aviso_index');
        
        const url = index ? `/api/avisos/${index}` : '/api/avisos';
        const method = index ? 'PUT' : 'POST';
        
        formData.set('data_inicio', formData.get('data_inicio').replace('T', ' '));
        formData.set('data_fim', formData.get('data_fim').replace('T', ' '));

        try {
            const response = await fetch(url, { method, body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showToast(result.message);
            closeModal();
            await fetchAvisos();
        } catch (error) {
            showToast(error.message, true);
        }
    };

    const handleDelete = async (index) => {
        if (!confirm(`Tem certeza que deseja remover o aviso "${avisosData[index].titulo}"?`)) return;
        try {
            const response = await fetch(`/api/avisos/${index}`, { method: 'DELETE' });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showToast(result.message);
            await fetchAvisos();
        } catch (error) {
            showToast(error.message, true);
        }
    };

    // --- EVENT LISTENERS ---
    addBtn.addEventListener('click', openModalForCreate);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    form.addEventListener('submit', handleFormSubmit);

    avisosContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            openModalForEdit(e.target.dataset.index);
        }
        if (e.target.classList.contains('delete-btn')) {
            handleDelete(e.target.dataset.index);
        }
    });

    // Inicia a aplicação
    fetchAvisos();
});