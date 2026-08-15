document.addEventListener(
    'DOMContentLoaded',
    loadRecommendedJobs
);


async function loadRecommendedJobs() {

    const jobList =
        document.getElementById('jobList');

    const summary =
        document.getElementById('summary');

    const roleText =
        document.getElementById('roleText');

    try {

        Api.requireAuth();

        const params =
            new URLSearchParams(
                window.location.search
            );

       let roleId = params.get('roleId');

if (!roleId) {
    roleId = sessionStorage.getItem('prp_role_id');
}

if (!roleId) {
    roleId = localStorage.getItem('prp_selected_role_id');
}

        if (!roleId) {

            jobList.innerHTML = `
                <div class="error">
                    Please select a job role first.
                </div>
            `;

            return;
        }


        console.log(
            'Loading jobs for role:',
            roleId
        );


        const data =
            await Api.getRecommendedOpenings(
                roleId,
                50
            );


        console.log(
            'Recommended jobs API response:',
            data
        );


        /*
         * Your current backend returns resumeId,
         * not data.resume.
         *
         * Therefore we should NOT do:
         *
         * if (!data.resume)
         *
         */


        const jobs =
            Array.isArray(data.jobs)
                ? data.jobs
                : [];


        roleText.textContent =
            jobs.length
                ? 'Showing verified openings matched against your resume'
                : 'No verified openings are currently available for this role.';


        renderSummary(
            summary,
            data,
            jobs
        );


        renderJobs(
            jobList,
            jobs
        );


    } catch (error) {

        console.error(
            'Recommended jobs error:',
            error
        );


        jobList.innerHTML = `
            <div class="error">

                <h3>
                    Unable to load job openings
                </h3>

                <p>
                    ${escapeHtml(
                        error.message ||
                        'Something went wrong.'
                    )}
                </p>

            </div>
        `;
    }
}



function renderSummary(
    container,
    data,
    jobs
) {

    /*
     * Your current backend does not yet return
     * resume.skills.
     *
     * Therefore use 0 until the backend sends
     * the extracted resume skills.
     */

    const resumeSkills =
        data.resume &&
        Array.isArray(data.resume.skills)
            ? data.resume.skills
            : [];


    const scores =
        jobs
            .map(job => Number(job.matchScore))
            .filter(score => !isNaN(score));


    const average =
        scores.length
            ? Math.round(
                scores.reduce(
                    (sum, score) =>
                        sum + score,
                    0
                ) / scores.length
            )
            : 0;


    container.innerHTML = `

        <div class="summary-card">

            <span>
                RESUME SKILLS
            </span>

            <strong>
                ${resumeSkills.length}
            </strong>

        </div>


        <div class="summary-card">

            <span>
                VERIFIED OPENINGS
            </span>

            <strong>
                ${jobs.length}
            </strong>

        </div>


        <div class="summary-card">

            <span>
                AVERAGE MATCH
            </span>

            <strong>
                ${average}%
            </strong>

        </div>

    `;
}



function renderJobs(
    container,
    jobs
) {

    if (!jobs.length) {

        container.innerHTML = `

            <div class="empty">

                <h3>
                    No verified openings found
                </h3>

                <p>
                    There are currently no verified
                    active openings for your selected role.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        jobs
            .map(createJobCard)
            .join('');
}



function createJobCard(job) {

    /*
     * Support both database field names
     * and camelCase field names.
     */

    const companyName =
        job.companyName ||
        job.company_name ||
        'Company';


    const jobTitle =
        job.jobTitle ||
        job.job_title ||
        'Job Opening';


    const location =
        job.location ||
        'Location not specified';


    const jobType =
        job.jobType ||
        job.job_type ||
        'Full-time';


    const experience =
        job.experience ||
        'Fresher';


    const jobUrl =
        job.jobUrl ||
        job.job_url ||
        '#';


    const matchScore =
        Number.isFinite(
            Number(job.matchScore)
        )
            ? Number(job.matchScore)
            : 0;


    const matched =
        Array.isArray(job.matchedSkills)
            ? job.matchedSkills
            : [];


    const missing =
        Array.isArray(job.missingSkills)
            ? job.missingSkills
            : [];


    const matchedHtml =
        matched.length

            ? matched
                .map(skill => `

                    <span class="skill matched">
                        ✓ ${escapeHtml(skill)}
                    </span>

                `)
                .join('')

            : `

                <span class="skill">
                    No matching skills calculated
                </span>

            `;


    const missingHtml =
        missing.length

            ? missing
                .map(skill => `

                    <span class="skill missing">
                        + ${escapeHtml(skill)}
                    </span>

                `)
                .join('')

            : `

                <span class="skill matched">
                    ✓ All required skills matched
                </span>

            `;


    /*
     * Only show "verified" when the backend
     * actually says the opening is verified.
     */

    const isVerified =
        job.verification_status === 'verified' ||
        job.verificationStatus === 'verified';


    const verificationHtml =
        isVerified

            ? `

                <div class="verified">
                    ✓ Verified official opening
                </div>

            `

            : `

                <div class="verified">
                    Opening verification pending
                </div>

            `;


    return `

        <article class="job-card">


            <div class="job-top">


                <div>

                    <div class="company">
                        ${escapeHtml(
                            companyName
                        )}
                    </div>


                    <div class="job-title">
                        ${escapeHtml(
                            jobTitle
                        )}
                    </div>


                    <div class="location">

                        📍
                        ${escapeHtml(
                            location
                        )}

                        &nbsp; • &nbsp;

                        ${escapeHtml(
                            jobType
                        )}

                        &nbsp; • &nbsp;

                        ${escapeHtml(
                            experience
                        )}

                    </div>

                </div>



                <div class="match">

                    <div class="match-number">
                        ${matchScore}%
                    </div>

                    <div class="match-label">
                        SKILL MATCH
                    </div>

                </div>


            </div>



            <div class="skills">

                <div class="skills-title">
                    Your matching skills
                </div>

                ${matchedHtml}

            </div>



            <div class="skills">

                <div class="skills-title">
                    Skills to improve
                </div>

                ${missingHtml}

            </div>



            <div class="job-footer">

                ${verificationHtml}


                <a
                    class="apply-btn"
                    href="${escapeHtml(jobUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Apply on Official Website →
                </a>

            </div>


        </article>

    `;
}



function escapeHtml(value) {

    return String(value ?? '')

        .replace(
            /&/g,
            '&amp;'
        )

        .replace(
            /</g,
            '&lt;'
        )

        .replace(
            />/g,
            '&gt;'
        )

        .replace(
            /"/g,
            '&quot;'
        )

        .replace(
            /'/g,
            '&#039;'
        );
}
